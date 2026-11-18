
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'canje'
      AND column_name = 'es_historico'
  ) THEN
    ALTER TABLE public.canje
      ADD COLUMN IF NOT EXISTS es_historico boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS puntos_descontados boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS stock_descontado boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS requiere_conciliacion_stock boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS puntos_devueltos boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS stock_devuelto boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS fecha_confirmacion timestamp without time zone,
      ADD COLUMN IF NOT EXISTS fecha_cancelacion timestamp without time zone;

    UPDATE public.canje
    SET
      es_historico = TRUE,
      puntos_descontados = TRUE,
      stock_descontado = FALSE,
      requiere_conciliacion_stock = TRUE,
      puntos_devueltos = FALSE,
      stock_devuelto = FALSE,
      fecha_confirmacion = CASE
        WHEN estado = 'Canjeado' THEN COALESCE(fecha, CURRENT_TIMESTAMP)
        ELSE NULL
      END
    WHERE estado IN ('Pendiente', 'Canjeado');
  END IF;
END
$$;

ALTER TABLE public.canje
  ADD COLUMN IF NOT EXISTS es_historico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS puntos_descontados boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_descontado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requiere_conciliacion_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS puntos_devueltos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_devuelto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_confirmacion timestamp without time zone,
  ADD COLUMN IF NOT EXISTS fecha_cancelacion timestamp without time zone;

UPDATE public.canje
SET
  puntos_descontados = TRUE,
  fecha_confirmacion = COALESCE(fecha_confirmacion, fecha, CURRENT_TIMESTAMP)
WHERE estado = 'Canjeado'
  AND NOT puntos_descontados;

ALTER TABLE public.canje
  DROP CONSTRAINT IF EXISTS canje_estado_valido;

ALTER TABLE public.canje
  ADD CONSTRAINT canje_estado_valido
  CHECK ((estado)::text = ANY ((ARRAY[
    'Pendiente'::character varying,
    'Canjeado'::character varying,
    'Cancelado'::character varying
  ])::text[]));

CREATE OR REPLACE FUNCTION public.generar_codigo_canje() RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_codigo VARCHAR(6);
  v_intentos INT := 0;
BEGIN
  IF NEW.estado = 'Cancelado' THEN
    NEW.codigo_canje := NULL;
    RETURN NEW;
  END IF;

  IF NEW.codigo_canje IS NULL THEN
    LOOP
      v_intentos := v_intentos + 1;
      v_codigo := LPAD(
        FLOOR(RANDOM() * 1000000)::INT::TEXT,
        6,
        '0'
      );

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.canje c
        WHERE c.codigo_canje = v_codigo
      );

      IF v_intentos >= 50 THEN
        RAISE EXCEPTION 'No fue posible generar un código de canje único';
      END IF;
    END LOOP;

    NEW.codigo_canje := v_codigo;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.procesar_canje() RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
    usuario_ciudadano UUID;
    saldo_actual INT;
    costo_recompensa INT;
    stock_actual INT;
BEGIN
    SELECT usuarioid
    INTO usuario_ciudadano
    FROM public.ciudadano
    WHERE id = NEW.ciudadanoid;

    IF usuario_ciudadano IS NULL THEN
        RAISE EXCEPTION 'El ciudadano no existe';
    END IF;

    SELECT ecopuntos
    INTO saldo_actual
    FROM public.usuario
    WHERE id = usuario_ciudadano;

    SELECT puntos_requeridos, cantidad_disponible
    INTO costo_recompensa, stock_actual
    FROM public.recompensas
    WHERE id = NEW.recompensaid
      AND estado = 'Activa';

    IF costo_recompensa IS NULL THEN
        RAISE EXCEPTION 'La recompensa no existe o no esta activa';
    END IF;

    IF stock_actual IS NOT NULL AND stock_actual <= 0 THEN
        RAISE EXCEPTION 'La recompensa no tiene disponibilidad';
    END IF;

    IF NEW.puntos_utilizados IS NULL OR NEW.puntos_utilizados <= 0 THEN
        NEW.puntos_utilizados := costo_recompensa;
    END IF;

    IF saldo_actual < NEW.puntos_utilizados THEN
        RAISE EXCEPTION 'Ecopuntos insuficientes para realizar el canje';
    END IF;

    NEW.estado := COALESCE(NEW.estado, 'Pendiente');
    NEW.es_historico := COALESCE(NEW.es_historico, FALSE);
    NEW.puntos_descontados := COALESCE(NEW.puntos_descontados, FALSE);
    NEW.stock_descontado := COALESCE(NEW.stock_descontado, FALSE);
    NEW.requiere_conciliacion_stock := COALESCE(NEW.requiere_conciliacion_stock, FALSE);
    NEW.puntos_devueltos := COALESCE(NEW.puntos_devueltos, FALSE);
    NEW.stock_devuelto := COALESCE(NEW.stock_devuelto, FALSE);

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.realizar_canje_ciudadano(p_recompensa_id integer)
RETURNS TABLE(
  canje_id integer,
  codigo_canje character varying,
  puntos_utilizados integer,
  estado character varying
)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_ciudadano_id INT;
  v_usuario_id UUID;
  v_saldo INT;
  v_puntos_requeridos INT;
  v_stock INT;
  v_comercio_id INT;
  v_estado_recompensa VARCHAR;
  v_canje_id INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  SELECT
    c.id,
    c.usuarioid
  INTO
    v_ciudadano_id,
    v_usuario_id
  FROM public.ciudadano c
  WHERE c.usuarioid = auth.uid();

  IF v_ciudadano_id IS NULL THEN
    RAISE EXCEPTION 'El usuario autenticado no es un ciudadano';
  END IF;

  SELECT
    r.puntos_requeridos,
    r.cantidad_disponible,
    r.comercioid,
    r.estado
  INTO
    v_puntos_requeridos,
    v_stock,
    v_comercio_id,
    v_estado_recompensa
  FROM public.recompensas r
  WHERE r.id = p_recompensa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La recompensa no existe';
  END IF;

  IF v_estado_recompensa <> 'Activa' THEN
    RAISE EXCEPTION 'La recompensa no está activa';
  END IF;

  IF v_stock IS NOT NULL AND v_stock <= 0 THEN
    RAISE EXCEPTION 'La recompensa no tiene stock disponible';
  END IF;

  SELECT
    u.ecopuntos
  INTO
    v_saldo
  FROM public.usuario u
  WHERE u.id = v_usuario_id
  FOR UPDATE;

  IF v_saldo < v_puntos_requeridos THEN
    RAISE EXCEPTION 'EcoPuntos insuficientes';
  END IF;

  INSERT INTO public.canje (
    puntos_utilizados,
    estado,
    ciudadanoid,
    recompensaid,
    comercioid,
    es_historico,
    puntos_descontados,
    stock_descontado,
    requiere_conciliacion_stock,
    puntos_devueltos,
    stock_devuelto
  )
  VALUES (
    v_puntos_requeridos,
    'Pendiente',
    v_ciudadano_id,
    p_recompensa_id,
    v_comercio_id,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE
  )
  RETURNING id
  INTO v_canje_id;

  RETURN QUERY
  SELECT
    c.id,
    c.codigo_canje,
    c.puntos_utilizados,
    c.estado
  FROM public.canje c
  WHERE c.id = v_canje_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_canjes_pendientes_ciudadano()
RETURNS TABLE(
  canje_id integer,
  codigo_canje character varying,
  puntos_utilizados integer,
  estado character varying,
  fecha timestamp without time zone,
  recompensaid integer,
  nombre_recompensa character varying,
  puntos_descontados boolean
)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_ciudadano_id INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  SELECT c.id
  INTO v_ciudadano_id
  FROM public.ciudadano c
  WHERE c.usuarioid = auth.uid();

  IF v_ciudadano_id IS NULL THEN
    RAISE EXCEPTION 'El usuario autenticado no es un ciudadano';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.codigo_canje,
    c.puntos_utilizados,
    c.estado,
    c.fecha,
    c.recompensaid,
    r.nombre,
    c.puntos_descontados
  FROM public.canje c
  JOIN public.recompensas r ON r.id = c.recompensaid
  WHERE c.ciudadanoid = v_ciudadano_id
    AND c.estado = 'Pendiente'
    AND c.codigo_canje IS NOT NULL
  ORDER BY c.fecha DESC, c.id DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_canje_ciudadano(p_canje_id integer)
RETURNS TABLE(
  canje_id integer,
  estado character varying,
  codigo_canje character varying,
  puntos_utilizados integer,
  puntos_reintegrados integer,
  saldo_ecopuntos integer,
  cancelado boolean
)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_ciudadano_id INT;
  v_usuario_id UUID;
  v_canje RECORD;
  v_saldo_actual INT;
  v_puntos_reintegrados INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  IF p_canje_id IS NULL THEN
    RAISE EXCEPTION 'Debes indicar el canje a cancelar';
  END IF;

  SELECT
    ci.id,
    ci.usuarioid
  INTO
    v_ciudadano_id,
    v_usuario_id
  FROM public.ciudadano ci
  WHERE ci.usuarioid = auth.uid();

  IF v_ciudadano_id IS NULL THEN
    RAISE EXCEPTION 'El usuario autenticado no es un ciudadano';
  END IF;

  SELECT
    c.id,
    c.ciudadanoid,
    c.recompensaid,
    c.puntos_utilizados,
    c.estado,
    c.codigo_canje,
    c.es_historico,
    c.puntos_descontados,
    c.stock_descontado,
    c.requiere_conciliacion_stock,
    c.puntos_devueltos,
    c.stock_devuelto
  INTO v_canje
  FROM public.canje c
  WHERE c.id = p_canje_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El canje no existe';
  END IF;

  IF v_canje.ciudadanoid <> v_ciudadano_id THEN
    RAISE EXCEPTION 'No tienes autorización para cancelar este canje';
  END IF;

  IF v_canje.estado = 'Canjeado' THEN
    RAISE EXCEPTION 'Este canje ya fue confirmado y no puede cancelarse';
  END IF;

  IF v_canje.estado = 'Cancelado' THEN
    SELECT u.ecopuntos
    INTO v_saldo_actual
    FROM public.usuario u
    WHERE u.id = v_usuario_id;

    RETURN QUERY
    SELECT
      v_canje.id,
      v_canje.estado,
      v_canje.codigo_canje,
      v_canje.puntos_utilizados,
      0,
      v_saldo_actual,
      FALSE;
    RETURN;
  END IF;

  IF v_canje.stock_descontado AND NOT v_canje.stock_devuelto THEN
    UPDATE public.recompensas r
    SET cantidad_disponible = r.cantidad_disponible + 1
    WHERE r.id = v_canje.recompensaid
      AND r.cantidad_disponible IS NOT NULL;
  END IF;

  SELECT u.ecopuntos
  INTO v_saldo_actual
  FROM public.usuario u
  WHERE u.id = v_usuario_id
  FOR UPDATE;

  IF v_canje.puntos_descontados AND NOT v_canje.puntos_devueltos THEN
    UPDATE public.usuario u
    SET ecopuntos = u.ecopuntos + v_canje.puntos_utilizados
    WHERE u.id = v_usuario_id
    RETURNING u.ecopuntos INTO v_saldo_actual;

    v_puntos_reintegrados := v_canje.puntos_utilizados;

    INSERT INTO public.historial_puntos (
      tipo,
      puntos,
      descripcion,
      ciudadanoid
    )
    VALUES (
      'Devueltos',
      v_canje.puntos_utilizados,
      'Ecopuntos devueltos por cancelación de canje pendiente',
      v_ciudadano_id
    );
  END IF;

  UPDATE public.canje c
  SET
    estado = 'Cancelado',
    codigo_canje = NULL,
    puntos_devueltos = CASE
      WHEN c.puntos_descontados THEN TRUE
      ELSE c.puntos_devueltos
    END,
    stock_devuelto = CASE
      WHEN c.stock_descontado THEN TRUE
      ELSE c.stock_devuelto
    END,
    requiere_conciliacion_stock = CASE
      WHEN c.es_historico AND NOT c.stock_descontado THEN TRUE
      ELSE c.requiere_conciliacion_stock
    END,
    fecha_cancelacion = COALESCE(c.fecha_cancelacion, CURRENT_TIMESTAMP)
  WHERE c.id = v_canje.id
    AND c.estado = 'Pendiente';

  RETURN QUERY
  SELECT
    v_canje.id,
    'Cancelado'::character varying,
    NULL::character varying,
    v_canje.puntos_utilizados,
    v_puntos_reintegrados,
    v_saldo_actual,
    TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.buscar_canje_comercio(
  p_tipo_documento character varying,
  p_numero_documento character varying,
  p_codigo_canje character varying
)
RETURNS TABLE(
  canje_id integer,
  nombre_ciudadano character varying,
  nombre_recompensa character varying,
  puntos_canje integer,
  estado_canje character varying
)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_comercio_id INT;
BEGIN
  SELECT id
  INTO v_comercio_id
  FROM public.comercio_aliado
  WHERE usuarioid = auth.uid()
    AND estado_validacion = 'Aprobado';

  IF v_comercio_id IS NULL THEN
    RAISE EXCEPTION 'El comercio no está autorizado para validar canjes';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    u.nombre,
    r.nombre,
    c.puntos_utilizados,
    c.estado
  FROM public.canje c
  JOIN public.ciudadano ci ON ci.id = c.ciudadanoid
  JOIN public.usuario u ON u.id = ci.usuarioid
  JOIN public.recompensas r ON r.id = c.recompensaid
  WHERE c.comercioid = v_comercio_id
    AND c.estado = 'Pendiente'
    AND c.codigo_canje IS NOT NULL
    AND c.codigo_canje = TRIM(p_codigo_canje)
    AND u.tipo_documento = TRIM(p_tipo_documento)
    AND u.numero_documento = TRIM(p_numero_documento);
END;
$$;


-- 8. RPC: Confirmar canje en comercio autorizado (cobra saldo y stock si aún no se descontaron)
CREATE OR REPLACE FUNCTION public.confirmar_canje_comercio(
  p_canje_id integer,
  p_codigo_canje character varying
)
RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_comercio_id INT;
  v_codigo VARCHAR(6);
  v_canje RECORD;
  v_stock_actual INT;
  v_recompensa_comercio_id INT;
  v_usuario_ciudadano UUID;
  v_saldo_actual INT;
  v_stock_descontado_final BOOLEAN;
BEGIN
  SELECT id
  INTO v_comercio_id
  FROM public.comercio_aliado
  WHERE usuarioid = auth.uid()
    AND estado_validacion = 'Aprobado';

  IF v_comercio_id IS NULL THEN
    RAISE EXCEPTION 'El comercio no está autorizado para confirmar canjes';
  END IF;

  v_codigo := TRIM(COALESCE(p_codigo_canje, ''));
  IF v_codigo !~ '^[0-9]{6}$' THEN
    RETURN FALSE;
  END IF;

  -- Orden de bloqueo consistente: 1) canje, 2) recompensas, 3) usuario
  SELECT
    c.id,
    c.ciudadanoid,
    c.recompensaid,
    c.comercioid,
    c.puntos_utilizados,
    c.estado,
    c.codigo_canje,
    c.es_historico,
    c.puntos_descontados,
    c.stock_descontado,
    c.requiere_conciliacion_stock,
    c.puntos_devueltos,
    c.stock_devuelto
  INTO v_canje
  FROM public.canje c
  WHERE c.id = p_canje_id
    AND c.comercioid = v_comercio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_canje.estado <> 'Pendiente'
     OR v_canje.codigo_canje IS NULL
     OR v_canje.codigo_canje <> v_codigo THEN
    RETURN FALSE;
  END IF;

  SELECT
    r.cantidad_disponible,
    r.comercioid
  INTO
    v_stock_actual,
    v_recompensa_comercio_id
  FROM public.recompensas r
  WHERE r.id = v_canje.recompensaid
  FOR UPDATE;

  IF NOT FOUND OR v_recompensa_comercio_id <> v_comercio_id THEN
    RAISE EXCEPTION 'La recompensa no corresponde al comercio autenticado';
  END IF;

  SELECT
    u.id,
    u.ecopuntos
  INTO
    v_usuario_ciudadano,
    v_saldo_actual
  FROM public.ciudadano ci
  JOIN public.usuario u ON u.id = ci.usuarioid
  WHERE ci.id = v_canje.ciudadanoid
  FOR UPDATE OF u;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el ciudadano titular del canje';
  END IF;

  IF NOT v_canje.es_historico AND (NOT v_canje.stock_descontado OR v_canje.stock_devuelto) THEN
    IF v_stock_actual IS NOT NULL AND v_stock_actual <= 0 THEN
      RAISE EXCEPTION 'La recompensa no tiene stock disponible';
    END IF;
  END IF;

  IF NOT v_canje.puntos_descontados OR v_canje.puntos_devueltos THEN
    IF v_saldo_actual < v_canje.puntos_utilizados THEN
      RAISE EXCEPTION 'EcoPuntos insuficientes para confirmar el canje';
    END IF;

    UPDATE public.usuario
    SET ecopuntos = ecopuntos - v_canje.puntos_utilizados
    WHERE id = v_usuario_ciudadano;

    INSERT INTO public.historial_puntos (
      tipo,
      puntos,
      descripcion,
      ciudadanoid
    )
    VALUES (
      'Canjeados',
      v_canje.puntos_utilizados,
      'Ecopuntos utilizados para canjear una recompensa',
      v_canje.ciudadanoid
    );
  END IF;

  v_stock_descontado_final := v_canje.stock_descontado;
  IF NOT v_canje.es_historico AND (NOT v_canje.stock_descontado OR v_canje.stock_devuelto) THEN
    IF v_stock_actual IS NOT NULL THEN
      UPDATE public.recompensas
      SET cantidad_disponible = cantidad_disponible - 1
      WHERE id = v_canje.recompensaid;
      v_stock_descontado_final := TRUE;
    ELSE
      v_stock_descontado_final := FALSE;
    END IF;
  END IF;

  UPDATE public.canje
  SET
    estado = 'Canjeado',
    puntos_descontados = TRUE,
    stock_descontado = v_stock_descontado_final,
    puntos_devueltos = FALSE,
    stock_devuelto = FALSE,
    fecha_confirmacion = COALESCE(fecha_confirmacion, CURRENT_TIMESTAMP)
  WHERE id = v_canje.id
    AND comercioid = v_comercio_id
    AND codigo_canje = v_codigo
    AND estado = 'Pendiente';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.generar_codigo_canje() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generar_codigo_canje() TO service_role;

REVOKE ALL ON FUNCTION public.procesar_canje() FROM PUBLIC;
GRANT ALL ON FUNCTION public.procesar_canje() TO service_role;

REVOKE ALL ON FUNCTION public.realizar_canje_ciudadano(integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.realizar_canje_ciudadano(integer) TO authenticated;
GRANT ALL ON FUNCTION public.realizar_canje_ciudadano(integer) TO service_role;

REVOKE ALL ON FUNCTION public.obtener_canjes_pendientes_ciudadano() FROM PUBLIC;
GRANT ALL ON FUNCTION public.obtener_canjes_pendientes_ciudadano() TO authenticated;
GRANT ALL ON FUNCTION public.obtener_canjes_pendientes_ciudadano() TO service_role;

REVOKE ALL ON FUNCTION public.cancelar_canje_ciudadano(integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancelar_canje_ciudadano(integer) TO authenticated;
GRANT ALL ON FUNCTION public.cancelar_canje_ciudadano(integer) TO service_role;

REVOKE ALL ON FUNCTION public.buscar_canje_comercio(character varying, character varying, character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION public.buscar_canje_comercio(character varying, character varying, character varying) TO authenticated;
GRANT ALL ON FUNCTION public.buscar_canje_comercio(character varying, character varying, character varying) TO service_role;

REVOKE ALL ON FUNCTION public.confirmar_canje_comercio(integer, character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirmar_canje_comercio(integer, character varying) TO authenticated;
GRANT ALL ON FUNCTION public.confirmar_canje_comercio(integer, character varying) TO service_role;

COMMIT;
