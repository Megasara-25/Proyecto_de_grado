


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."acreditar_ecopuntos"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    usuario_ciudadano UUID;
BEGIN

    IF NEW.estado = 'Aprobada'
       AND OLD.estado <> 'Aprobada'
       AND NEW.puntos_acreditados = FALSE THEN

        SELECT usuarioid
        INTO usuario_ciudadano
        FROM ciudadano
        WHERE id = NEW.ciudadanoid;

        UPDATE usuario
        SET ecopuntos = ecopuntos + NEW.puntos_obtenidos
        WHERE id = usuario_ciudadano;

        INSERT INTO historial_puntos (
            tipo,
            puntos,
            descripcion,
            ciudadanoid
        )
        VALUES (
            'Ganados',
            NEW.puntos_obtenidos,
            'Ecopuntos obtenidos por entrega de material reciclable',
            NEW.ciudadanoid
        );

        NEW.puntos_acreditados := TRUE;

    END IF;

    RETURN NEW;

END;
$$;


ALTER FUNCTION "public"."acreditar_ecopuntos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_estado_entrega_reciclador"("p_entrega_id" integer, "p_estado" character varying, "p_motivo_rechazo" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$

DECLARE
    v_reciclador_id INT;

BEGIN

    -- Solo permitimos aprobar o rechazar
    IF p_estado NOT IN ('Aprobada', 'Rechazada') THEN
        RAISE EXCEPTION 'Estado de entrega no válido';
    END IF;

    -- Si se rechaza, el motivo es obligatorio
    IF p_estado = 'Rechazada'
       AND (
           p_motivo_rechazo IS NULL
           OR TRIM(p_motivo_rechazo) = ''
       )
    THEN
        RAISE EXCEPTION 'Debe indicar el motivo del rechazo';
    END IF;

    -- Identificar al reciclador autenticado
    SELECT id
    INTO v_reciclador_id
    FROM reciclador
    WHERE usuarioid = auth.uid()
      AND estado_validacion = 'Aprobado';

    IF v_reciclador_id IS NULL THEN
        RAISE EXCEPTION 'El reciclador no está autorizado';
    END IF;

    -- Actualizar únicamente una entrega pendiente
    -- perteneciente a este reciclador
    UPDATE entrega
    SET
        estado = p_estado,

        motivo_rechazo =
            CASE
                WHEN p_estado = 'Rechazada'
                    THEN TRIM(p_motivo_rechazo)
                ELSE NULL
            END

    WHERE id = p_entrega_id
      AND recicladorid = v_reciclador_id
      AND estado = 'Pendiente';

    RETURN FOUND;

END;

$$;


ALTER FUNCTION "public"."actualizar_estado_entrega_reciclador"("p_entrega_id" integer, "p_estado" character varying, "p_motivo_rechazo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_mi_perfil"("p_nombre" "text", "p_telefono" "text", "p_fecha_nacimiento" "date", "p_foto_perfil_url" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    IF NULLIF(TRIM(p_nombre), '') IS NULL THEN
        RAISE EXCEPTION 'El nombre no puede estar vacío';
    END IF;

    IF LENGTH(TRIM(p_nombre)) > 150 THEN
        RAISE EXCEPTION 'El nombre es demasiado largo';
    END IF;

    IF p_telefono IS NOT NULL
       AND LENGTH(TRIM(p_telefono)) > 30 THEN
        RAISE EXCEPTION 'El teléfono es demasiado largo';
    END IF;

    IF p_fecha_nacimiento > CURRENT_DATE THEN
        RAISE EXCEPTION 'La fecha de nacimiento no puede ser futura';
    END IF;

    IF p_foto_perfil_url IS NOT NULL
       AND (
           LENGTH(p_foto_perfil_url) > 255
           OR p_foto_perfil_url !~
              ('^' || auth.uid()::TEXT || '/[a-zA-Z0-9._-]+$')
       ) THEN
        RAISE EXCEPTION 'Ruta de fotografía no válida';
    END IF;

    UPDATE public.usuario
    SET
        nombre = TRIM(p_nombre),
        telefono = NULLIF(TRIM(p_telefono), ''),
        fecha_nacimiento = p_fecha_nacimiento,
        foto_perfil_url = p_foto_perfil_url
    WHERE id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil no encontrado';
    END IF;
END;
$_$;


ALTER FUNCTION "public"."actualizar_mi_perfil"("p_nombre" "text", "p_telefono" "text", "p_fecha_nacimiento" "date", "p_foto_perfil_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_perfil_comercio"("p_nombre_comercio" "text", "p_foto_perfil_url" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_comercio_id integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión';
    END IF;

    SELECT c.id
    INTO v_comercio_id
    FROM public.comercio_aliado c
    JOIN public.usuario u ON u.id = c.usuarioid
    WHERE c.usuarioid = auth.uid()
      AND u.rol = 'comercio_aliado';

    IF v_comercio_id IS NULL THEN
        RAISE EXCEPTION 'No tienes un comercio aliado registrado';
    END IF;

    IF NULLIF(TRIM(p_nombre_comercio), '') IS NULL THEN
        RAISE EXCEPTION 'El nombre del establecimiento es obligatorio';
    END IF;

    UPDATE public.comercio_aliado
    SET nombre_comercio = TRIM(p_nombre_comercio)
    WHERE id = v_comercio_id;

    UPDATE public.usuario
    SET foto_perfil_url = COALESCE(
        NULLIF(TRIM(p_foto_perfil_url), ''),
        foto_perfil_url
    )
    WHERE id = auth.uid();

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."actualizar_perfil_comercio"("p_nombre_comercio" "text", "p_foto_perfil_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_recompensa_comercio"("p_recompensa_id" integer, "p_nombre" "text", "p_descripcion" "text", "p_puntos_requeridos" integer, "p_categoria" "text", "p_estado" "text", "p_imagen_url" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_comercio_id INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión';
    END IF;

    SELECT c.id
    INTO v_comercio_id
    FROM public.comercio_aliado c
    JOIN public.usuario u ON u.id = c.usuarioid
    WHERE c.usuarioid = auth.uid()
      AND u.rol = 'comercio_aliado'
      AND c.estado_validacion = 'Aprobado';

    IF v_comercio_id IS NULL THEN
        RAISE EXCEPTION 'No tienes un comercio aliado aprobado';
    END IF;

    IF NULLIF(TRIM(p_nombre), '') IS NULL THEN
        RAISE EXCEPTION 'El nombre es obligatorio';
    END IF;

    IF p_puntos_requeridos IS NULL OR p_puntos_requeridos <= 0 THEN
        RAISE EXCEPTION 'Los EcoPuntos deben ser mayores que cero';
    END IF;

    IF p_estado IS NULL OR p_estado NOT IN ('Activa', 'Inactiva') THEN
        RAISE EXCEPTION 'Estado de recompensa no válido';
    END IF;

    UPDATE public.recompensas
    SET
        nombre = TRIM(p_nombre),
        descripcion = NULLIF(TRIM(p_descripcion), ''),
        puntos_requeridos = p_puntos_requeridos,
        categoria = NULLIF(TRIM(p_categoria), ''),
        estado = p_estado,
        imagen_url = COALESCE(
            NULLIF(TRIM(p_imagen_url), ''),
            imagen_url
        )
    WHERE id = p_recompensa_id
      AND comercioid = v_comercio_id;

    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."actualizar_recompensa_comercio"("p_recompensa_id" integer, "p_nombre" "text", "p_descripcion" "text", "p_puntos_requeridos" integer, "p_categoria" "text", "p_estado" "text", "p_imagen_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."buscar_canje_comercio"("p_tipo_documento" character varying, "p_numero_documento" character varying, "p_codigo_canje" character varying) RETURNS TABLE("canje_id" integer, "nombre_ciudadano" character varying, "nombre_recompensa" character varying, "puntos_canje" integer, "estado_canje" character varying)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_comercio_id INT;
BEGIN

  SELECT id
  INTO v_comercio_id
  FROM comercio_aliado
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
  FROM canje c
  JOIN ciudadano ci ON ci.id = c.ciudadanoid
  JOIN usuario u ON u.id = ci.usuarioid
  JOIN recompensas r ON r.id = c.recompensaid
  WHERE c.comercioid = v_comercio_id
    AND c.estado = 'Pendiente'
    AND c.codigo_canje = p_codigo_canje
    AND u.tipo_documento = p_tipo_documento
    AND u.numero_documento = p_numero_documento;

END;
$$;


ALTER FUNCTION "public"."buscar_canje_comercio"("p_tipo_documento" character varying, "p_numero_documento" character varying, "p_codigo_canje" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_puntos_entrega"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    puntos_material INT;
BEGIN

    SELECT puntos_por_kilo
    INTO puntos_material
    FROM material
    WHERE id = NEW.materialid;

    NEW.puntos_obtenidos :=
        FLOOR(NEW.cantidad * puntos_material);

    RETURN NEW;

END;
$$;


ALTER FUNCTION "public"."calcular_puntos_entrega"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirmar_canje_comercio"("p_canje_id" integer, "p_codigo_canje" character varying) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_comercio_id INT;
BEGIN

  SELECT id
  INTO v_comercio_id
  FROM comercio_aliado
  WHERE usuarioid = auth.uid()
    AND estado_validacion = 'Aprobado';

  IF v_comercio_id IS NULL THEN
    RAISE EXCEPTION 'El comercio no está autorizado para confirmar canjes';
  END IF;

  UPDATE canje
  SET estado = 'Canjeado'
  WHERE id = p_canje_id
    AND comercioid = v_comercio_id
    AND codigo_canje = p_codigo_canje
    AND estado = 'Pendiente';

  RETURN FOUND;

END;
$$;


ALTER FUNCTION "public"."confirmar_canje_comercio"("p_canje_id" integer, "p_codigo_canje" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_perfil_usuario"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
    v_rol TEXT;
    v_reciclador_id INTEGER;
    v_material_id INTEGER;
    v_materiales JSONB;
    v_latitud NUMERIC;
    v_longitud NUMERIC;
BEGIN
    v_rol := NEW.raw_user_meta_data ->> 'rol';

    IF v_rol IS NULL OR v_rol = '' THEN
        RETURN NEW;
    END IF;

    IF v_rol NOT IN ('ciudadano', 'reciclador', 'comercio_aliado') THEN
        RAISE EXCEPTION 'Rol no permitido';
    END IF;

    -- Validar los datos específicos del reciclador.
    IF v_rol = 'reciclador' THEN

        v_materiales := NEW.raw_user_meta_data -> 'materiales_recibidos';

        IF v_materiales IS NULL
           OR jsonb_typeof(v_materiales) <> 'array'
           OR jsonb_array_length(v_materiales) = 0 THEN
            RAISE EXCEPTION 'Debes seleccionar al menos un material';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM jsonb_array_elements(v_materiales) AS elemento(valor)
            WHERE jsonb_typeof(elemento.valor) <> 'number'
               OR elemento.valor::text !~ '^[0-9]+$'
               OR NOT EXISTS (
                   SELECT 1
                   FROM public.material m
                   WHERE m.id::text = elemento.valor::text
               )
        ) THEN
            RAISE EXCEPTION 'Material no válido';
        END IF;

        v_latitud := (NEW.raw_user_meta_data ->> 'latitud')::NUMERIC;
        v_longitud := (NEW.raw_user_meta_data ->> 'longitud')::NUMERIC;

        IF v_latitud IS NULL
           OR v_longitud IS NULL
           OR v_latitud NOT BETWEEN -90 AND 90
           OR v_longitud NOT BETWEEN -180 AND 180 THEN
            RAISE EXCEPTION 'Ubicación del centro no válida';
        END IF;

    END IF;

    -- Crear usuario.
    INSERT INTO public.usuario (
        id, nombre, correo, fecha_nacimiento,
        telefono, rol, ecopuntos,
        tipo_documento, numero_documento
    )
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data ->> 'nombre',
        NEW.email,
        NULLIF(NEW.raw_user_meta_data ->> 'fecha_nacimiento', '')::DATE,
        NEW.raw_user_meta_data ->> 'telefono',
        v_rol,
        0,
        NEW.raw_user_meta_data ->> 'tipo_documento',
        NEW.raw_user_meta_data ->> 'numero_documento'
    );

    IF v_rol = 'ciudadano' THEN

        INSERT INTO public.ciudadano (usuarioid)
        VALUES (NEW.id);

    ELSIF v_rol = 'reciclador' THEN

        -- Crear centro con sus coordenadas.
        INSERT INTO public.reciclador (
            nombre_centro,
            direccion,
            ciudad,
            latitud,
            longitud,
            usuarioid,
            estado_validacion
        )
        VALUES (
            NEW.raw_user_meta_data ->> 'nombre_centro',
            NEW.raw_user_meta_data ->> 'direccion',
            NEW.raw_user_meta_data ->> 'ciudad',
            v_latitud,
            v_longitud,
            NEW.id,
            'Pendiente'
        )
        RETURNING id INTO v_reciclador_id;

        -- Asociar los materiales seleccionados.
        FOR v_material_id IN
            SELECT DISTINCT valor::text::integer
            FROM jsonb_array_elements(v_materiales) AS elemento(valor)
        LOOP
            INSERT INTO public.material_reciclador (
                materialid,
                recicladorid
            )
            VALUES (
                v_material_id,
                v_reciclador_id
            );
        END LOOP;

    ELSIF v_rol = 'comercio_aliado' THEN

        INSERT INTO public.comercio_aliado (
            nombre_comercio,
            nit,
            categoria,
            direccion,
            ciudad,
            usuarioid,
            estado_validacion
        )
        VALUES (
            NEW.raw_user_meta_data ->> 'nombre_comercio',
            NEW.raw_user_meta_data ->> 'nit',
            NEW.raw_user_meta_data ->> 'categoria',
            NEW.raw_user_meta_data ->> 'direccion',
            NEW.raw_user_meta_data ->> 'ciudad',
            NEW.id,
            'Pendiente'
        );

    END IF;

    RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."crear_perfil_usuario"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_recompensa_comercio"("p_nombre" "text", "p_descripcion" "text", "p_puntos_requeridos" integer, "p_cantidad_disponible" integer, "p_categoria" "text" DEFAULT NULL::"text", "p_imagen_url" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_comercio_id INTEGER;
    v_recompensa_id INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión';
    END IF;

    SELECT c.id
    INTO v_comercio_id
    FROM public.comercio_aliado c
    JOIN public.usuario u ON u.id = c.usuarioid
    WHERE c.usuarioid = auth.uid()
      AND u.rol = 'comercio_aliado'
      AND c.estado_validacion = 'Aprobado';

    IF v_comercio_id IS NULL THEN
        RAISE EXCEPTION 'No tienes un comercio aliado aprobado';
    END IF;

    IF NULLIF(TRIM(p_nombre), '') IS NULL THEN
        RAISE EXCEPTION 'El nombre de la recompensa es obligatorio';
    END IF;

    IF p_puntos_requeridos IS NULL OR p_puntos_requeridos <= 0 THEN
        RAISE EXCEPTION 'Los puntos requeridos deben ser mayores que cero';
    END IF;

    IF p_cantidad_disponible IS NULL OR p_cantidad_disponible < 0 THEN
        RAISE EXCEPTION 'La cantidad disponible no puede ser negativa';
    END IF;

    INSERT INTO public.recompensas (
        nombre,
        descripcion,
        puntos_requeridos,
        cantidad_disponible,
        estado,
        comercioid,
        categoria,
        imagen_url
    )
    VALUES (
        TRIM(p_nombre),
        NULLIF(TRIM(p_descripcion), ''),
        p_puntos_requeridos,
        p_cantidad_disponible,
        'Activa',
        v_comercio_id,
        NULLIF(TRIM(p_categoria), ''),
        NULLIF(TRIM(p_imagen_url), '')
    )
    RETURNING id INTO v_recompensa_id;

    RETURN v_recompensa_id;
END;
$$;


ALTER FUNCTION "public"."crear_recompensa_comercio"("p_nombre" "text", "p_descripcion" "text", "p_puntos_requeridos" integer, "p_cantidad_disponible" integer, "p_categoria" "text", "p_imagen_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generar_codigo_canje"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.codigo_canje IS NULL THEN
    NEW.codigo_canje := LPAD(
      FLOOR(RANDOM() * 1000000)::INT::TEXT,
      6,
      '0'
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generar_codigo_canje"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gestionar_solicitud_ecocycle"("p_tipo" character varying, "p_solicitud_id" integer, "p_estado" character varying) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_es_admin BOOLEAN;
BEGIN

  SELECT EXISTS (
    SELECT 1
    FROM usuario
    WHERE id = auth.uid()
      AND rol = 'admin'
  )
  INTO v_es_admin;

  IF NOT v_es_admin THEN
    RAISE EXCEPTION 'No tienes permisos de administrador';
  END IF;


  IF p_estado NOT IN ('Aprobado', 'Rechazado') THEN
    RAISE EXCEPTION 'Estado de validación no válido';
  END IF;


  IF p_tipo = 'reciclador' THEN

    UPDATE reciclador
    SET estado_validacion = p_estado
    WHERE id = p_solicitud_id
      AND estado_validacion = 'Pendiente';

    RETURN FOUND;


  ELSIF p_tipo = 'comercio_aliado' THEN

    UPDATE comercio_aliado
    SET estado_validacion = p_estado
    WHERE id = p_solicitud_id
      AND estado_validacion = 'Pendiente';

    RETURN FOUND;


  ELSE

    RAISE EXCEPTION 'Tipo de solicitud no válido';

  END IF;

END;
$$;


ALTER FUNCTION "public"."gestionar_solicitud_ecocycle"("p_tipo" character varying, "p_solicitud_id" integer, "p_estado" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guardar_ubicacion_reciclador"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_latitud NUMERIC;
    v_longitud NUMERIC;
BEGIN
    IF NEW.raw_user_meta_data ->> 'rol' <> 'reciclador' THEN
        RETURN NEW;
    END IF;

    v_latitud := (NEW.raw_user_meta_data ->> 'latitud')::NUMERIC;
    v_longitud := (NEW.raw_user_meta_data ->> 'longitud')::NUMERIC;

    IF v_latitud IS NULL OR v_longitud IS NULL
       OR v_latitud NOT BETWEEN -90 AND 90
       OR v_longitud NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'Ubicación del centro no válida';
    END IF;

    UPDATE public.reciclador
    SET latitud = v_latitud,
        longitud = v_longitud
    WHERE usuarioid = NEW.id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guardar_ubicacion_reciclador"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."historial_canjes_comercio"() RETURNS TABLE("canje_id" integer, "nombre_recompensa" character varying, "puntos_utilizados" integer, "estado_canje" character varying, "fecha_canje" timestamp without time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_comercio_id INTEGER;
BEGIN
    SELECT ca.id
    INTO v_comercio_id
    FROM public.comercio_aliado ca
    INNER JOIN public.usuario u
        ON u.id = ca.usuarioid
    WHERE ca.usuarioid = (SELECT auth.uid())
      AND u.rol = 'comercio_aliado'
      AND ca.estado_validacion = 'Aprobado';

    IF v_comercio_id IS NULL THEN
        RAISE EXCEPTION 'Comercio no autorizado';
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        r.nombre,
        c.puntos_utilizados,
        c.estado,
        c.fecha
    FROM public.canje c
    INNER JOIN public.recompensas r
        ON r.id = c.recompensaid
    WHERE c.comercioid = v_comercio_id
      AND c.estado = 'Canjeado'
    ORDER BY c.fecha DESC, c.id DESC;
END;
$$;


ALTER FUNCTION "public"."historial_canjes_comercio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obtener_solicitudes_pendientes"() RETURNS TABLE("solicitud_id" integer, "tipo" "text", "nombre" "text", "correo" "text", "nombre_entidad" "text", "direccion" "text", "ciudad" "text", "estado_validacion" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_es_admin BOOLEAN;
BEGIN

  SELECT EXISTS (
    SELECT 1
    FROM public.usuario
    WHERE id = auth.uid()
      AND rol = 'admin'
  )
  INTO v_es_admin;


  IF NOT v_es_admin THEN
    RAISE EXCEPTION 'No tienes permisos de administrador';
  END IF;


  RETURN QUERY

  SELECT
    r.id,
    'reciclador'::TEXT,
    u.nombre::TEXT,
    u.correo::TEXT,
    r.nombre_centro::TEXT,
    r.direccion::TEXT,
    r.ciudad::TEXT,
    r.estado_validacion::TEXT
  FROM public.reciclador r
  INNER JOIN public.usuario u
    ON u.id = r.usuarioid
  WHERE r.estado_validacion = 'Pendiente'


  UNION ALL


  SELECT
    c.id,
    'comercio_aliado'::TEXT,
    u.nombre::TEXT,
    u.correo::TEXT,
    c.nombre_comercio::TEXT,
    c.direccion::TEXT,
    c.ciudad::TEXT,
    c.estado_validacion::TEXT
  FROM public.comercio_aliado c
  INNER JOIN public.usuario u
    ON u.id = c.usuarioid
  WHERE c.estado_validacion = 'Pendiente';

END;
$$;


ALTER FUNCTION "public"."obtener_solicitudes_pendientes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."procesar_canje"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    usuario_ciudadano UUID;
    saldo_actual INT;
    costo_recompensa INT;
    stock_actual INT;
BEGIN

    -- Obtener el usuario relacionado con el ciudadano
    SELECT usuarioid
    INTO usuario_ciudadano
    FROM ciudadano
    WHERE id = NEW.ciudadanoid;

    -- Obtener saldo actual
    SELECT ecopuntos
    INTO saldo_actual
    FROM usuario
    WHERE id = usuario_ciudadano;

    -- Obtener costo y disponibilidad de la recompensa
    SELECT puntos_requeridos, cantidad_disponible
    INTO costo_recompensa, stock_actual
    FROM recompensas
    WHERE id = NEW.recompensaid
      AND estado = 'Activa';

    -- Validar que la recompensa exista y esté activa
    IF costo_recompensa IS NULL THEN
        RAISE EXCEPTION 'La recompensa no existe o no esta activa';
    END IF;

    -- Validar puntos suficientes
    IF saldo_actual < costo_recompensa THEN
        RAISE EXCEPTION 'Ecopuntos insuficientes para realizar el canje';
    END IF;

    -- Validar disponibilidad
    IF stock_actual IS NOT NULL AND stock_actual <= 0 THEN
        RAISE EXCEPTION 'La recompensa no tiene disponibilidad';
    END IF;

    -- El valor real siempre viene de la recompensa
    NEW.puntos_utilizados := costo_recompensa;

    -- Descontar Ecopuntos
    UPDATE usuario
    SET ecopuntos = ecopuntos - costo_recompensa
    WHERE id = usuario_ciudadano;

    -- Descontar una unidad de la recompensa
    IF stock_actual IS NOT NULL THEN
        UPDATE recompensas
        SET cantidad_disponible = cantidad_disponible - 1
        WHERE id = NEW.recompensaid;
    END IF;

    -- Registrar movimiento
    INSERT INTO historial_puntos (
        tipo,
        puntos,
        descripcion,
        ciudadanoid
    )
    VALUES (
        'Canjeados',
        costo_recompensa,
        'Ecopuntos utilizados para canjear una recompensa',
        NEW.ciudadanoid
    );

    RETURN NEW;

END;
$$;


ALTER FUNCTION "public"."procesar_canje"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."realizar_canje_ciudadano"("p_recompensa_id" integer) RETURNS TABLE("canje_id" integer, "codigo_canje" character varying, "puntos_utilizados" integer, "estado" character varying)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  SELECT
    c.id,
    c.usuarioid
  INTO
    v_ciudadano_id,
    v_usuario_id
  FROM ciudadano c
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
  FROM recompensas r
  WHERE r.id = p_recompensa_id
  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION 'La recompensa no existe';
  END IF;


  IF v_estado_recompensa <> 'Activa' THEN
    RAISE EXCEPTION 'La recompensa no está activa';
  END IF;


  IF v_stock IS NULL OR v_stock <= 0 THEN
    RAISE EXCEPTION 'La recompensa no tiene stock disponible';
  END IF;


  SELECT
    u.ecopuntos
  INTO
    v_saldo
  FROM usuario u
  WHERE u.id = v_usuario_id
  FOR UPDATE;


  IF v_saldo < v_puntos_requeridos THEN
    RAISE EXCEPTION 'EcoPuntos insuficientes';
  END IF;


  INSERT INTO canje (
    puntos_utilizados,
    estado,
    ciudadanoid,
    recompensaid,
    comercioid
  )
  VALUES (
    v_puntos_requeridos,
    'Pendiente',
    v_ciudadano_id,
    p_recompensa_id,
    v_comercio_id
  )
  RETURNING id
  INTO v_canje_id;


  RETURN QUERY
  SELECT
    c.id,
    c.codigo_canje,
    c.puntos_utilizados,
    c.estado
  FROM canje c
  WHERE c.id = v_canje_id;

END;
$$;


ALTER FUNCTION "public"."realizar_canje_ciudadano"("p_recompensa_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_entrega_ciudadano"("p_material_id" integer, "p_reciclador_id" integer, "p_cantidad" numeric) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_ciudadano_id INTEGER;
    v_entrega_id INTEGER;
BEGIN
    -- Validar cantidad
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor que cero';
    END IF;

    -- Identificar al ciudadano autenticado
    SELECT c.id
    INTO v_ciudadano_id
    FROM public.ciudadano c
    WHERE c.usuarioid = auth.uid();

    IF v_ciudadano_id IS NULL THEN
        RAISE EXCEPTION 'El usuario autenticado no es un ciudadano';
    END IF;

    -- Comprobar que el centro esté aprobado
    IF NOT EXISTS (
        SELECT 1
        FROM public.reciclador r
        WHERE r.id = p_reciclador_id
          AND r.estado_validacion = 'Aprobado'
    ) THEN
        RAISE EXCEPTION
            'El centro de reciclaje no está aprobado o no existe';
    END IF;

    -- Comprobar que el centro reciba el material
    IF NOT EXISTS (
        SELECT 1
        FROM public.material_reciclador mr
        WHERE mr.materialid = p_material_id
          AND mr.recicladorid = p_reciclador_id
    ) THEN
        RAISE EXCEPTION
            'El centro seleccionado no recibe este material';
    END IF;

    -- Registrar la entrega pendiente
    INSERT INTO public.entrega (
        cantidad,
        estado,
        puntos_acreditados,
        ciudadanoid,
        recicladorid,
        materialid
    )
    VALUES (
        p_cantidad,
        'Pendiente',
        FALSE,
        v_ciudadano_id,
        p_reciclador_id,
        p_material_id
    )
    RETURNING id INTO v_entrega_id;

    RETURN v_entrega_id;
END;
$$;


ALTER FUNCTION "public"."registrar_entrega_ciudadano"("p_material_id" integer, "p_reciclador_id" integer, "p_cantidad" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_comercio_canje"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    comercio_recompensa INT;
BEGIN

    SELECT comercioid
    INTO comercio_recompensa
    FROM recompensas
    WHERE id = NEW.recompensaid;

    IF comercio_recompensa IS NULL THEN
        RAISE EXCEPTION 'La recompensa no existe';
    END IF;

    IF NEW.comercioid <> comercio_recompensa THEN
        RAISE EXCEPTION 'El comercio no corresponde a la recompensa seleccionada';
    END IF;

    RETURN NEW;

END;
$$;


ALTER FUNCTION "public"."validar_comercio_canje"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."canje" (
    "id" integer NOT NULL,
    "codigo_qr" "uuid" DEFAULT "gen_random_uuid"(),
    "puntos_utilizados" integer NOT NULL,
    "estado" character varying(50) DEFAULT 'Pendiente'::character varying,
    "fecha" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "ciudadanoid" integer NOT NULL,
    "recompensaid" integer NOT NULL,
    "comercioid" integer NOT NULL,
    "codigo_canje" character varying(6),
    CONSTRAINT "canje_estado_valido" CHECK ((("estado")::"text" = ANY ((ARRAY['Pendiente'::character varying, 'Canjeado'::character varying])::"text"[])))
);


ALTER TABLE "public"."canje" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."canje_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."canje_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."canje_id_seq" OWNED BY "public"."canje"."id";



CREATE TABLE IF NOT EXISTS "public"."ciudadano" (
    "id" integer NOT NULL,
    "direccion" character varying(255),
    "ciudad" character varying(100),
    "usuarioid" "uuid" NOT NULL
);


ALTER TABLE "public"."ciudadano" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ciudadano_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ciudadano_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ciudadano_id_seq" OWNED BY "public"."ciudadano"."id";



CREATE TABLE IF NOT EXISTS "public"."comercio_aliado" (
    "id" integer NOT NULL,
    "nombre_comercio" character varying(255) NOT NULL,
    "nit" character varying(50),
    "categoria" character varying(100),
    "direccion" character varying(255) NOT NULL,
    "ciudad" character varying(100),
    "usuarioid" "uuid" NOT NULL,
    "estado_validacion" character varying(20) DEFAULT 'Pendiente'::character varying,
    CONSTRAINT "comercio_estado_validacion_valido" CHECK ((("estado_validacion")::"text" = ANY ((ARRAY['Pendiente'::character varying, 'Aprobado'::character varying, 'Rechazado'::character varying])::"text"[])))
);


ALTER TABLE "public"."comercio_aliado" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."comercio_aliado_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."comercio_aliado_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."comercio_aliado_id_seq" OWNED BY "public"."comercio_aliado"."id";



CREATE TABLE IF NOT EXISTS "public"."entrega" (
    "id" integer NOT NULL,
    "cantidad" numeric(10,2) NOT NULL,
    "puntos_obtenidos" integer DEFAULT 0,
    "estado" character varying(50) DEFAULT 'Pendiente'::character varying,
    "fecha" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "ciudadanoid" integer NOT NULL,
    "recicladorid" integer NOT NULL,
    "materialid" integer NOT NULL,
    "puntos_acreditados" boolean DEFAULT false,
    "motivo_rechazo" "text",
    CONSTRAINT "entrega_cantidad_positiva" CHECK (("cantidad" > (0)::numeric)),
    CONSTRAINT "entrega_estado_valido" CHECK ((("estado")::"text" = ANY ((ARRAY['Pendiente'::character varying, 'Aprobada'::character varying, 'Rechazada'::character varying])::"text"[])))
);


ALTER TABLE "public"."entrega" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."entrega_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."entrega_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."entrega_id_seq" OWNED BY "public"."entrega"."id";



CREATE TABLE IF NOT EXISTS "public"."historial_puntos" (
    "id" integer NOT NULL,
    "tipo" character varying(50) NOT NULL,
    "puntos" integer NOT NULL,
    "descripcion" character varying(255),
    "fecha" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "ciudadanoid" integer NOT NULL
);


ALTER TABLE "public"."historial_puntos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."historial_puntos_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."historial_puntos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."historial_puntos_id_seq" OWNED BY "public"."historial_puntos"."id";



CREATE TABLE IF NOT EXISTS "public"."material" (
    "id" integer NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "puntos_por_kilo" integer NOT NULL
);


ALTER TABLE "public"."material" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."material_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."material_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."material_id_seq" OWNED BY "public"."material"."id";



CREATE TABLE IF NOT EXISTS "public"."material_reciclador" (
    "id" integer NOT NULL,
    "materialid" integer NOT NULL,
    "recicladorid" integer NOT NULL
);


ALTER TABLE "public"."material_reciclador" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."material_reciclador_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."material_reciclador_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."material_reciclador_id_seq" OWNED BY "public"."material_reciclador"."id";



CREATE TABLE IF NOT EXISTS "public"."reciclador" (
    "id" integer NOT NULL,
    "nombre_centro" character varying(255) NOT NULL,
    "direccion" character varying(255) NOT NULL,
    "ciudad" character varying(100),
    "latitud" numeric(10,7),
    "longitud" numeric(10,7),
    "usuarioid" "uuid" NOT NULL,
    "estado_validacion" character varying(20) DEFAULT 'Pendiente'::character varying,
    CONSTRAINT "reciclador_estado_validacion_valido" CHECK ((("estado_validacion")::"text" = ANY ((ARRAY['Pendiente'::character varying, 'Aprobado'::character varying, 'Rechazado'::character varying])::"text"[])))
);


ALTER TABLE "public"."reciclador" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."reciclador_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."reciclador_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."reciclador_id_seq" OWNED BY "public"."reciclador"."id";



CREATE TABLE IF NOT EXISTS "public"."recompensas" (
    "id" integer NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "descripcion" "text",
    "puntos_requeridos" integer NOT NULL,
    "cantidad_disponible" integer NOT NULL,
    "estado" character varying(50) DEFAULT 'Activa'::character varying NOT NULL,
    "comercioid" integer NOT NULL,
    "imagen_url" "text",
    "categoria" character varying(50),
    CONSTRAINT "recompensa_estado_valido" CHECK ((("estado")::"text" = ANY ((ARRAY['Activa'::character varying, 'Inactiva'::character varying])::"text"[]))),
    CONSTRAINT "recompensa_puntos_positivos" CHECK (("puntos_requeridos" > 0)),
    CONSTRAINT "recompensa_stock_no_negativo" CHECK (("cantidad_disponible" >= 0))
);


ALTER TABLE "public"."recompensas" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."recompensas_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."recompensas_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."recompensas_id_seq" OWNED BY "public"."recompensas"."id";



CREATE TABLE IF NOT EXISTS "public"."usuario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "correo" character varying(255) NOT NULL,
    "fecha_nacimiento" "date",
    "telefono" character varying(20),
    "rol" character varying(50) NOT NULL,
    "ecopuntos" integer DEFAULT 0,
    "tipo_documento" character varying(20),
    "numero_documento" character varying(30),
    "foto_perfil_url" "text",
    CONSTRAINT "usuario_ecopuntos_no_negativos" CHECK (("ecopuntos" >= 0)),
    CONSTRAINT "usuario_rol_valido" CHECK ((("rol")::"text" = ANY ((ARRAY['ciudadano'::character varying, 'reciclador'::character varying, 'comercio_aliado'::character varying, 'admin'::character varying])::"text"[]))),
    CONSTRAINT "usuario_tipo_documento_valido" CHECK (((("tipo_documento")::"text" = ANY ((ARRAY['CC'::character varying, 'TI'::character varying, 'CE'::character varying, 'PASAPORTE'::character varying])::"text"[])) OR ("tipo_documento" IS NULL)))
);


ALTER TABLE "public"."usuario" OWNER TO "postgres";


ALTER TABLE ONLY "public"."canje" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."canje_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ciudadano" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ciudadano_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."comercio_aliado" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."comercio_aliado_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."entrega" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."entrega_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."historial_puntos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."historial_puntos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."material" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."material_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."material_reciclador" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."material_reciclador_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."reciclador" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."reciclador_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."recompensas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."recompensas_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."canje"
    ADD CONSTRAINT "canje_codigo_canje_key" UNIQUE ("codigo_canje");



ALTER TABLE ONLY "public"."canje"
    ADD CONSTRAINT "canje_codigo_qr_key" UNIQUE ("codigo_qr");



ALTER TABLE ONLY "public"."canje"
    ADD CONSTRAINT "canje_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ciudadano"
    ADD CONSTRAINT "ciudadano_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ciudadano"
    ADD CONSTRAINT "ciudadano_usuarioid_key" UNIQUE ("usuarioid");



ALTER TABLE ONLY "public"."comercio_aliado"
    ADD CONSTRAINT "comercio_aliado_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comercio_aliado"
    ADD CONSTRAINT "comercio_aliado_usuarioid_key" UNIQUE ("usuarioid");



ALTER TABLE ONLY "public"."entrega"
    ADD CONSTRAINT "entrega_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_puntos"
    ADD CONSTRAINT "historial_puntos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material"
    ADD CONSTRAINT "material_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."material"
    ADD CONSTRAINT "material_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_reciclador"
    ADD CONSTRAINT "material_reciclador_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_reciclador"
    ADD CONSTRAINT "material_reciclador_unico" UNIQUE ("recicladorid", "materialid");



ALTER TABLE ONLY "public"."reciclador"
    ADD CONSTRAINT "reciclador_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reciclador"
    ADD CONSTRAINT "reciclador_usuarioid_key" UNIQUE ("usuarioid");



ALTER TABLE ONLY "public"."recompensas"
    ADD CONSTRAINT "recompensas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_correo_key" UNIQUE ("correo");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_numero_documento_key" UNIQUE ("numero_documento");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "trigger_acreditar_ecopuntos" BEFORE UPDATE OF "estado" ON "public"."entrega" FOR EACH ROW EXECUTE FUNCTION "public"."acreditar_ecopuntos"();



CREATE OR REPLACE TRIGGER "trigger_calcular_puntos_entrega" BEFORE INSERT OR UPDATE OF "cantidad", "materialid" ON "public"."entrega" FOR EACH ROW EXECUTE FUNCTION "public"."calcular_puntos_entrega"();



CREATE OR REPLACE TRIGGER "trigger_generar_codigo_canje" BEFORE INSERT ON "public"."canje" FOR EACH ROW EXECUTE FUNCTION "public"."generar_codigo_canje"();



CREATE OR REPLACE TRIGGER "trigger_procesar_canje" BEFORE INSERT ON "public"."canje" FOR EACH ROW EXECUTE FUNCTION "public"."procesar_canje"();



CREATE OR REPLACE TRIGGER "trigger_validar_comercio_canje" BEFORE INSERT OR UPDATE ON "public"."canje" FOR EACH ROW EXECUTE FUNCTION "public"."validar_comercio_canje"();



ALTER TABLE ONLY "public"."canje"
    ADD CONSTRAINT "canje_ciudadanoid_fkey" FOREIGN KEY ("ciudadanoid") REFERENCES "public"."ciudadano"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."canje"
    ADD CONSTRAINT "canje_comercioid_fkey" FOREIGN KEY ("comercioid") REFERENCES "public"."comercio_aliado"("id");



ALTER TABLE ONLY "public"."canje"
    ADD CONSTRAINT "canje_recompensaid_fkey" FOREIGN KEY ("recompensaid") REFERENCES "public"."recompensas"("id");



ALTER TABLE ONLY "public"."ciudadano"
    ADD CONSTRAINT "ciudadano_usuarioid_fkey" FOREIGN KEY ("usuarioid") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comercio_aliado"
    ADD CONSTRAINT "comercio_aliado_usuarioid_fkey" FOREIGN KEY ("usuarioid") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entrega"
    ADD CONSTRAINT "entrega_ciudadanoid_fkey" FOREIGN KEY ("ciudadanoid") REFERENCES "public"."ciudadano"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entrega"
    ADD CONSTRAINT "entrega_materialid_fkey" FOREIGN KEY ("materialid") REFERENCES "public"."material"("id");



ALTER TABLE ONLY "public"."entrega"
    ADD CONSTRAINT "entrega_recicladorid_fkey" FOREIGN KEY ("recicladorid") REFERENCES "public"."reciclador"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historial_puntos"
    ADD CONSTRAINT "historial_puntos_ciudadanoid_fkey" FOREIGN KEY ("ciudadanoid") REFERENCES "public"."ciudadano"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_reciclador"
    ADD CONSTRAINT "material_reciclador_materialid_fkey" FOREIGN KEY ("materialid") REFERENCES "public"."material"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_reciclador"
    ADD CONSTRAINT "material_reciclador_recicladorid_fkey" FOREIGN KEY ("recicladorid") REFERENCES "public"."reciclador"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reciclador"
    ADD CONSTRAINT "reciclador_usuarioid_fkey" FOREIGN KEY ("usuarioid") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recompensas"
    ADD CONSTRAINT "recompensas_comercioid_fkey" FOREIGN KEY ("comercioid") REFERENCES "public"."comercio_aliado"("id") ON DELETE CASCADE;



CREATE POLICY "Ciudadano puede ver su historial de puntos" ON "public"."historial_puntos" FOR SELECT TO "authenticated" USING (("ciudadanoid" IN ( SELECT "ciudadano"."id"
   FROM "public"."ciudadano"
  WHERE ("ciudadano"."usuarioid" = "auth"."uid"()))));



CREATE POLICY "Ciudadano puede ver su propio perfil" ON "public"."ciudadano" FOR SELECT TO "authenticated" USING (("usuarioid" = "auth"."uid"()));



CREATE POLICY "Ciudadano puede ver sus canjes" ON "public"."canje" FOR SELECT TO "authenticated" USING (("ciudadanoid" IN ( SELECT "ciudadano"."id"
   FROM "public"."ciudadano"
  WHERE ("ciudadano"."usuarioid" = "auth"."uid"()))));



CREATE POLICY "Ciudadano puede ver sus entregas" ON "public"."entrega" FOR SELECT TO "authenticated" USING (("ciudadanoid" IN ( SELECT "ciudadano"."id"
   FROM "public"."ciudadano"
  WHERE ("ciudadano"."usuarioid" = "auth"."uid"()))));



CREATE POLICY "Comercio aprobado puede actualizar sus recompensas" ON "public"."recompensas" FOR UPDATE TO "authenticated" USING (("comercioid" IN ( SELECT "comercio_aliado"."id"
   FROM "public"."comercio_aliado"
  WHERE (("comercio_aliado"."usuarioid" = "auth"."uid"()) AND (("comercio_aliado"."estado_validacion")::"text" = 'Aprobado'::"text"))))) WITH CHECK (("comercioid" IN ( SELECT "comercio_aliado"."id"
   FROM "public"."comercio_aliado"
  WHERE (("comercio_aliado"."usuarioid" = "auth"."uid"()) AND (("comercio_aliado"."estado_validacion")::"text" = 'Aprobado'::"text")))));



CREATE POLICY "Comercio aprobado puede crear sus recompensas" ON "public"."recompensas" FOR INSERT TO "authenticated" WITH CHECK (("comercioid" IN ( SELECT "comercio_aliado"."id"
   FROM "public"."comercio_aliado"
  WHERE (("comercio_aliado"."usuarioid" = "auth"."uid"()) AND (("comercio_aliado"."estado_validacion")::"text" = 'Aprobado'::"text")))));



CREATE POLICY "Comercio aprobado puede ver sus canjes" ON "public"."canje" FOR SELECT TO "authenticated" USING (("comercioid" IN ( SELECT "comercio_aliado"."id"
   FROM "public"."comercio_aliado"
  WHERE (("comercio_aliado"."usuarioid" = "auth"."uid"()) AND (("comercio_aliado"."estado_validacion")::"text" = 'Aprobado'::"text")))));



CREATE POLICY "Comercio aprobado puede ver sus recompensas" ON "public"."recompensas" FOR SELECT TO "authenticated" USING (("comercioid" IN ( SELECT "comercio_aliado"."id"
   FROM "public"."comercio_aliado"
  WHERE (("comercio_aliado"."usuarioid" = "auth"."uid"()) AND (("comercio_aliado"."estado_validacion")::"text" = 'Aprobado'::"text")))));



CREATE POLICY "Comercio puede ver su propio perfil" ON "public"."comercio_aliado" FOR SELECT TO "authenticated" USING (("usuarioid" = "auth"."uid"()));



CREATE POLICY "Reciclador aprobado puede ver entregas de su centro" ON "public"."entrega" FOR SELECT TO "authenticated" USING (("recicladorid" IN ( SELECT "reciclador"."id"
   FROM "public"."reciclador"
  WHERE (("reciclador"."usuarioid" = "auth"."uid"()) AND (("reciclador"."estado_validacion")::"text" = 'Aprobado'::"text")))));



CREATE POLICY "Reciclador puede ver su propio perfil" ON "public"."reciclador" FOR SELECT TO "authenticated" USING (("usuarioid" = "auth"."uid"()));



CREATE POLICY "Usuario puede ver su propio perfil" ON "public"."usuario" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Usuarios pueden ver centros aprobados" ON "public"."reciclador" FOR SELECT TO "authenticated" USING ((("estado_validacion")::"text" = 'Aprobado'::"text"));



CREATE POLICY "Usuarios pueden ver materiales" ON "public"."material" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Usuarios pueden ver materiales de cada reciclador" ON "public"."material_reciclador" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Usuarios pueden ver recompensas activas" ON "public"."recompensas" FOR SELECT TO "authenticated" USING ((("estado")::"text" = 'Activa'::"text"));



ALTER TABLE "public"."canje" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ciudadano" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comercio_aliado" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entrega" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."historial_puntos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_reciclador" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reciclador" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recompensas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usuario" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."acreditar_ecopuntos"() TO "anon";
GRANT ALL ON FUNCTION "public"."acreditar_ecopuntos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."acreditar_ecopuntos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."actualizar_estado_entrega_reciclador"("p_entrega_id" integer, "p_estado" character varying, "p_motivo_rechazo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."actualizar_estado_entrega_reciclador"("p_entrega_id" integer, "p_estado" character varying, "p_motivo_rechazo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_estado_entrega_reciclador"("p_entrega_id" integer, "p_estado" character varying, "p_motivo_rechazo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."actualizar_mi_perfil"("p_nombre" "text", "p_telefono" "text", "p_fecha_nacimiento" "date", "p_foto_perfil_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."actualizar_mi_perfil"("p_nombre" "text", "p_telefono" "text", "p_fecha_nacimiento" "date", "p_foto_perfil_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_mi_perfil"("p_nombre" "text", "p_telefono" "text", "p_fecha_nacimiento" "date", "p_foto_perfil_url" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."actualizar_perfil_comercio"("p_nombre_comercio" "text", "p_foto_perfil_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."actualizar_perfil_comercio"("p_nombre_comercio" "text", "p_foto_perfil_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_perfil_comercio"("p_nombre_comercio" "text", "p_foto_perfil_url" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."actualizar_recompensa_comercio"("p_recompensa_id" integer, "p_nombre" "text", "p_descripcion" "text", "p_puntos_requeridos" integer, "p_categoria" "text", "p_estado" "text", "p_imagen_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."actualizar_recompensa_comercio"("p_recompensa_id" integer, "p_nombre" "text", "p_descripcion" "text", "p_puntos_requeridos" integer, "p_categoria" "text", "p_estado" "text", "p_imagen_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_recompensa_comercio"("p_recompensa_id" integer, "p_nombre" "text", "p_descripcion" "text", "p_puntos_requeridos" integer, "p_categoria" "text", "p_estado" "text", "p_imagen_url" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."buscar_canje_comercio"("p_tipo_documento" character varying, "p_numero_documento" character varying, "p_codigo_canje" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."buscar_canje_comercio"("p_tipo_documento" character varying, "p_numero_documento" character varying, "p_codigo_canje" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."buscar_canje_comercio"("p_tipo_documento" character varying, "p_numero_documento" character varying, "p_codigo_canje" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."calcular_puntos_entrega"() TO "anon";
GRANT ALL ON FUNCTION "public"."calcular_puntos_entrega"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcular_puntos_entrega"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirmar_canje_comercio"("p_canje_id" integer, "p_codigo_canje" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirmar_canje_comercio"("p_canje_id" integer, "p_codigo_canje" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirmar_canje_comercio"("p_canje_id" integer, "p_codigo_canje" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_perfil_usuario"() TO "anon";
GRANT ALL ON FUNCTION "public"."crear_perfil_usuario"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_perfil_usuario"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."crear_recompensa_comercio"("p_nombre" "text", "p_descripcion" "text", "p_puntos_requeridos" integer, "p_cantidad_disponible" integer, "p_categoria" "text", "p_imagen_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."crear_recompensa_comercio"("p_nombre" "text", "p_descripcion" "text", "p_puntos_requeridos" integer, "p_cantidad_disponible" integer, "p_categoria" "text", "p_imagen_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_recompensa_comercio"("p_nombre" "text", "p_descripcion" "text", "p_puntos_requeridos" integer, "p_cantidad_disponible" integer, "p_categoria" "text", "p_imagen_url" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generar_codigo_canje"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generar_codigo_canje"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gestionar_solicitud_ecocycle"("p_tipo" character varying, "p_solicitud_id" integer, "p_estado" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gestionar_solicitud_ecocycle"("p_tipo" character varying, "p_solicitud_id" integer, "p_estado" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gestionar_solicitud_ecocycle"("p_tipo" character varying, "p_solicitud_id" integer, "p_estado" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "public"."guardar_ubicacion_reciclador"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guardar_ubicacion_reciclador"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."historial_canjes_comercio"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."historial_canjes_comercio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."historial_canjes_comercio"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."obtener_solicitudes_pendientes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obtener_solicitudes_pendientes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."obtener_solicitudes_pendientes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."procesar_canje"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."procesar_canje"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."realizar_canje_ciudadano"("p_recompensa_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."realizar_canje_ciudadano"("p_recompensa_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."realizar_canje_ciudadano"("p_recompensa_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_entrega_ciudadano"("p_material_id" integer, "p_reciclador_id" integer, "p_cantidad" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_entrega_ciudadano"("p_material_id" integer, "p_reciclador_id" integer, "p_cantidad" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_entrega_ciudadano"("p_material_id" integer, "p_reciclador_id" integer, "p_cantidad" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."validar_comercio_canje"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validar_comercio_canje"() TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."canje" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."canje" TO "authenticated";
GRANT ALL ON TABLE "public"."canje" TO "service_role";



GRANT ALL ON SEQUENCE "public"."canje_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."canje_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."canje_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ciudadano" TO "anon";
GRANT ALL ON TABLE "public"."ciudadano" TO "authenticated";
GRANT ALL ON TABLE "public"."ciudadano" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ciudadano_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ciudadano_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ciudadano_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comercio_aliado" TO "anon";
GRANT ALL ON TABLE "public"."comercio_aliado" TO "authenticated";
GRANT ALL ON TABLE "public"."comercio_aliado" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comercio_aliado_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comercio_aliado_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comercio_aliado_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."entrega" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."entrega" TO "authenticated";
GRANT ALL ON TABLE "public"."entrega" TO "service_role";



GRANT ALL ON SEQUENCE "public"."entrega_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."entrega_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."entrega_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."historial_puntos" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."historial_puntos" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_puntos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."historial_puntos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."historial_puntos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."historial_puntos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."material" TO "anon";
GRANT ALL ON TABLE "public"."material" TO "authenticated";
GRANT ALL ON TABLE "public"."material" TO "service_role";



GRANT ALL ON SEQUENCE "public"."material_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."material_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."material_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."material_reciclador" TO "anon";
GRANT ALL ON TABLE "public"."material_reciclador" TO "authenticated";
GRANT ALL ON TABLE "public"."material_reciclador" TO "service_role";



GRANT ALL ON SEQUENCE "public"."material_reciclador_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."material_reciclador_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."material_reciclador_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reciclador" TO "anon";
GRANT ALL ON TABLE "public"."reciclador" TO "authenticated";
GRANT ALL ON TABLE "public"."reciclador" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reciclador_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reciclador_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reciclador_id_seq" TO "service_role";



GRANT SELECT,DELETE,MAINTAIN ON TABLE "public"."recompensas" TO "anon";
GRANT SELECT,DELETE,MAINTAIN ON TABLE "public"."recompensas" TO "authenticated";
GRANT ALL ON TABLE "public"."recompensas" TO "service_role";



GRANT UPDATE("nombre") ON TABLE "public"."recompensas" TO "authenticated";



GRANT UPDATE("descripcion") ON TABLE "public"."recompensas" TO "authenticated";



GRANT UPDATE("puntos_requeridos") ON TABLE "public"."recompensas" TO "authenticated";



GRANT UPDATE("estado") ON TABLE "public"."recompensas" TO "authenticated";



GRANT UPDATE("imagen_url") ON TABLE "public"."recompensas" TO "authenticated";



GRANT UPDATE("categoria") ON TABLE "public"."recompensas" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."recompensas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."recompensas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."recompensas_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."usuario" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."usuario" TO "authenticated";
GRANT ALL ON TABLE "public"."usuario" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







