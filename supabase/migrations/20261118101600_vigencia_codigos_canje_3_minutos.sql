BEGIN;

ALTER TABLE public.canje
  ADD COLUMN IF NOT EXISTS expira_en timestamp with time zone,
  ADD COLUMN IF NOT EXISTS sesion_id text;

UPDATE public.canje
SET codigo_canje = NULL
WHERE estado = 'Pendiente'
  AND (expira_en IS NULL OR sesion_id IS NULL)
  AND codigo_canje IS NOT NULL;


DROP FUNCTION IF EXISTS public.obtener_sesion_actual_id(text);
DROP FUNCTION IF EXISTS public.obtener_sesion_actual_id();

CREATE OR REPLACE FUNCTION public.obtener_sesion_actual_id()
RETURNS text
    LANGUAGE plpgsql
    STABLE
    SET search_path TO 'public'
AS $$
DECLARE
  v_jwt_claims jsonb;
  v_sesion_jwt text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  BEGIN
    v_jwt_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_sesion_jwt := NULLIF(TRIM(COALESCE(
    v_jwt_claims ->> 'session_id',
    current_setting('request.jwt.claim.session_id', true)
  )), '');

  IF v_sesion_jwt IS NULL THEN
    RAISE EXCEPTION 'No se encontró una sesión autenticada válida (claim session_id ausente en el JWT)';
  END IF;

  RETURN v_sesion_jwt;
END;
$$;

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

  IF NEW.codigo_canje IS NULL AND (NEW.expira_en IS NOT NULL OR NEW.es_historico) THEN
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

  IF NOT COALESCE(NEW.es_historico, FALSE) AND NEW.expira_en IS NULL THEN
    NEW.expira_en := now() + interval '3 minutes';
  END IF;

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.realizar_canje_ciudadano(integer, text);
DROP FUNCTION IF EXISTS public.realizar_canje_ciudadano(integer);

CREATE OR REPLACE FUNCTION public.realizar_canje_ciudadano(
  p_recompensa_id integer
)
RETURNS TABLE(
  canje_id integer,
  codigo_canje character varying,
  puntos_utilizados integer,
  estado character varying,
  expira_en timestamp with time zone,
  ahora_servidor timestamp with time zone
)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_ciudadano_id INT;
  v_usuario_id UUID;
  v_sesion_id TEXT;
  v_saldo INT;
  v_puntos_requeridos INT;
  v_stock INT;
  v_comercio_id INT;
  v_estado_recompensa VARCHAR;
  v_canje_id INT;
  v_ahora TIMESTAMPTZ := now();
  v_expira_en TIMESTAMPTZ := v_ahora + interval '3 minutes';
BEGIN
  v_sesion_id := public.obtener_sesion_actual_id();

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
    stock_devuelto,
    expira_en,
    sesion_id
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
    FALSE,
    v_expira_en,
    v_sesion_id
  )
  RETURNING id
  INTO v_canje_id;

  RETURN QUERY
  SELECT
    c.id,
    c.codigo_canje,
    c.puntos_utilizados,
    c.estado,
    c.expira_en,
    v_ahora
  FROM public.canje c
  WHERE c.id = v_canje_id;
END;
$$;

DROP FUNCTION IF EXISTS public.reemplazar_codigo_canje_ciudadano(integer, text);
DROP FUNCTION IF EXISTS public.reemplazar_codigo_canje_ciudadano(integer);

CREATE OR REPLACE FUNCTION public.reemplazar_codigo_canje_ciudadano(
  p_canje_id integer
)
RETURNS TABLE(
  canje_id integer,
  codigo_canje character varying,
  puntos_utilizados integer,
  estado character varying,
  recompensaid integer,
  nombre_recompensa character varying,
  expira_en timestamp with time zone,
  ahora_servidor timestamp with time zone
)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_ciudadano_id INT;
  v_usuario_id UUID;
  v_sesion_id TEXT;
  v_canje RECORD;
  v_estado_recompensa VARCHAR;
  v_stock_actual INT;
  v_nombre_recompensa VARCHAR;
  v_saldo_actual INT;
  v_nuevo_codigo VARCHAR(6);
  v_intentos INT := 0;
  v_ahora TIMESTAMPTZ := now();
  v_nuevo_expira_en TIMESTAMPTZ := v_ahora + interval '3 minutes';
BEGIN
  v_sesion_id := public.obtener_sesion_actual_id();

  IF p_canje_id IS NULL THEN
    RAISE EXCEPTION 'Debes indicar el canje a reemplazar';
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
    c.sesion_id
  INTO v_canje
  FROM public.canje c
  WHERE c.id = p_canje_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El canje no existe';
  END IF;

  IF v_canje.ciudadanoid <> v_ciudadano_id THEN
    RAISE EXCEPTION 'No tienes autorización para reemplazar este código';
  END IF;

  IF v_canje.estado = 'Canjeado' THEN
    RAISE EXCEPTION 'Este canje ya fue confirmado y no puede reemplazarse';
  END IF;

  IF v_canje.estado = 'Cancelado' THEN
    RAISE EXCEPTION 'Este canje fue cancelado y no puede reemplazarse';
  END IF;

  IF v_canje.sesion_id IS NOT NULL AND v_canje.sesion_id <> v_sesion_id THEN
    RAISE EXCEPTION 'El canje no pertenece a la sesión autenticada actual';
  END IF;

  SELECT
    r.nombre,
    r.estado,
    r.cantidad_disponible
  INTO
    v_nombre_recompensa,
    v_estado_recompensa,
    v_stock_actual
  FROM public.recompensas r
  WHERE r.id = v_canje.recompensaid
  FOR UPDATE;

  IF NOT FOUND OR v_estado_recompensa <> 'Activa' THEN
    RAISE EXCEPTION 'La recompensa ya no está activa';
  END IF;

  IF NOT v_canje.es_historico AND NOT v_canje.stock_descontado AND v_stock_actual IS NOT NULL AND v_stock_actual <= 0 THEN
    RAISE EXCEPTION 'La recompensa ya no tiene stock disponible';
  END IF;

  SELECT u.ecopuntos
  INTO v_saldo_actual
  FROM public.usuario u
  WHERE u.id = v_usuario_id
  FOR UPDATE;

  IF NOT v_canje.puntos_descontados AND v_saldo_actual < v_canje.puntos_utilizados THEN
    RAISE EXCEPTION 'EcoPuntos insuficientes para generar un nuevo código';
  END IF;

  LOOP
    v_intentos := v_intentos + 1;
    v_nuevo_codigo := LPAD(
      FLOOR(RANDOM() * 1000000)::INT::TEXT,
      6,
      '0'
    );

    EXIT WHEN v_nuevo_codigo <> COALESCE(v_canje.codigo_canje, '')
      AND NOT EXISTS (
        SELECT 1
        FROM public.canje c
        WHERE c.codigo_canje = v_nuevo_codigo
      );

    IF v_intentos >= 50 THEN
      RAISE EXCEPTION 'No fue posible generar un código de reemplazo único';
    END IF;
  END LOOP;

  -- Invalida el código anterior reemplazándolo por uno nuevo con 3 minutos de vigencia
  -- y vinculándolo a la sesión autenticada actual
  UPDATE public.canje c
  SET
    codigo_canje = v_nuevo_codigo,
    expira_en = v_nuevo_expira_en,
    sesion_id = v_sesion_id,
    fecha = CURRENT_TIMESTAMP
  WHERE c.id = v_canje.id
    AND c.estado = 'Pendiente';

  RETURN QUERY
  SELECT
    v_canje.id,
    v_nuevo_codigo,
    v_canje.puntos_utilizados,
    'Pendiente'::character varying,
    v_canje.recompensaid,
    v_nombre_recompensa,
    v_nuevo_expira_en,
    v_ahora;
END;
$$;


DROP FUNCTION IF EXISTS public.obtener_canjes_pendientes_ciudadano(text);
DROP FUNCTION IF EXISTS public.obtener_canjes_pendientes_ciudadano();

CREATE OR REPLACE FUNCTION public.obtener_canjes_pendientes_ciudadano()
RETURNS TABLE(
  canje_id integer,
  codigo_canje character varying,
  puntos_utilizados integer,
  estado character varying,
  fecha timestamp without time zone,
  recompensaid integer,
  nombre_recompensa character varying,
  puntos_descontados boolean,
  es_historico boolean,
  expira_en timestamp with time zone,
  ahora_servidor timestamp with time zone
)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_ciudadano_id INT;
  v_sesion_id TEXT;
  v_ahora TIMESTAMPTZ := now();
BEGIN
  v_sesion_id := public.obtener_sesion_actual_id();

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
    CASE
      WHEN c.expira_en IS NOT NULL
           AND c.expira_en > v_ahora
           AND c.sesion_id = v_sesion_id
      THEN c.codigo_canje
      ELSE NULL::character varying
    END,
    c.puntos_utilizados,
    c.estado,
    c.fecha,
    c.recompensaid,
    r.nombre,
    c.puntos_descontados,
    c.es_historico,
    c.expira_en,
    v_ahora
  FROM public.canje c
  JOIN public.recompensas r ON r.id = c.recompensaid
  WHERE c.ciudadanoid = v_ciudadano_id
    AND c.estado = 'Pendiente'
    AND (
      c.sesion_id = v_sesion_id
      OR
      (c.sesion_id IS NULL AND c.expira_en IS NULL)
    )
  ORDER BY c.fecha DESC, c.id DESC;
END;
$$;


DROP FUNCTION IF EXISTS public.invalidar_canjes_sesion_ciudadano(text);
DROP FUNCTION IF EXISTS public.invalidar_canjes_sesion_ciudadano();

CREATE OR REPLACE FUNCTION public.invalidar_canjes_sesion_ciudadano()
RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_ciudadano_id INT;
  v_sesion_id TEXT;
  v_invalidados_cobrados INT := 0;
  v_invalidados_no_cobrados INT := 0;
BEGIN
  v_sesion_id := public.obtener_sesion_actual_id();

  SELECT c.id
  INTO v_ciudadano_id
  FROM public.ciudadano c
  WHERE c.usuarioid = auth.uid();

  IF v_ciudadano_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.canje c
  SET
    codigo_canje = NULL,
    expira_en = NULL,
    sesion_id = NULL
  WHERE c.ciudadanoid = v_ciudadano_id
    AND c.estado = 'Pendiente'
    AND c.puntos_descontados = TRUE
    AND c.sesion_id = v_sesion_id;

  GET DIAGNOSTICS v_invalidados_cobrados = ROW_COUNT;

  UPDATE public.canje c
  SET
    estado = 'Cancelado',
    codigo_canje = NULL,
    expira_en = COALESCE(LEAST(c.expira_en, now()), now()),
    fecha_cancelacion = COALESCE(c.fecha_cancelacion, CURRENT_TIMESTAMP)
  WHERE c.ciudadanoid = v_ciudadano_id
    AND c.estado = 'Pendiente'
    AND NOT c.puntos_descontados
    AND (c.sesion_id = v_sesion_id OR (c.sesion_id IS NULL AND c.expira_en IS NULL));

  GET DIAGNOSTICS v_invalidados_no_cobrados = ROW_COUNT;

  RETURN v_invalidados_cobrados + v_invalidados_no_cobrados;
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
  v_ahora TIMESTAMPTZ := now();
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
    AND c.sesion_id IS NOT NULL
    AND c.expira_en IS NOT NULL
    AND c.expira_en > v_ahora
    AND u.tipo_documento = TRIM(p_tipo_documento)
    AND u.numero_documento = TRIM(p_numero_documento);
END;
$$;

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
  v_ahora TIMESTAMPTZ := now();
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
    c.stock_devuelto,
    c.expira_en,
    c.sesion_id
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
     OR v_canje.codigo_canje <> v_codigo
     OR v_canje.sesion_id IS NULL
     OR v_canje.expira_en IS NULL
     OR v_canje.expira_en <= v_ahora THEN
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

REVOKE ALL ON FUNCTION public.obtener_sesion_actual_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.obtener_sesion_actual_id() TO authenticated;
GRANT ALL ON FUNCTION public.obtener_sesion_actual_id() TO service_role;

REVOKE ALL ON FUNCTION public.generar_codigo_canje() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generar_codigo_canje() TO service_role;

REVOKE ALL ON FUNCTION public.realizar_canje_ciudadano(integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.realizar_canje_ciudadano(integer) TO authenticated;
GRANT ALL ON FUNCTION public.realizar_canje_ciudadano(integer) TO service_role;

REVOKE ALL ON FUNCTION public.reemplazar_codigo_canje_ciudadano(integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reemplazar_codigo_canje_ciudadano(integer) TO authenticated;
GRANT ALL ON FUNCTION public.reemplazar_codigo_canje_ciudadano(integer) TO service_role;

REVOKE ALL ON FUNCTION public.obtener_canjes_pendientes_ciudadano() FROM PUBLIC;
GRANT ALL ON FUNCTION public.obtener_canjes_pendientes_ciudadano() TO authenticated;
GRANT ALL ON FUNCTION public.obtener_canjes_pendientes_ciudadano() TO service_role;

REVOKE ALL ON FUNCTION public.invalidar_canjes_sesion_ciudadano() FROM PUBLIC;
GRANT ALL ON FUNCTION public.invalidar_canjes_sesion_ciudadano() TO authenticated;
GRANT ALL ON FUNCTION public.invalidar_canjes_sesion_ciudadano() TO service_role;

REVOKE ALL ON FUNCTION public.buscar_canje_comercio(character varying, character varying, character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION public.buscar_canje_comercio(character varying, character varying, character varying) TO authenticated;
GRANT ALL ON FUNCTION public.buscar_canje_comercio(character varying, character varying, character varying) TO service_role;

REVOKE ALL ON FUNCTION public.confirmar_canje_comercio(integer, character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirmar_canje_comercio(integer, character varying) TO authenticated;
GRANT ALL ON FUNCTION public.confirmar_canje_comercio(integer, character varying) TO service_role;

COMMIT;
