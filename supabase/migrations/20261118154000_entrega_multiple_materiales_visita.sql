BEGIN;

ALTER TABLE public.entrega
  ADD COLUMN IF NOT EXISTS solicitud_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS entrega_solicitud_material_unico
  ON public.entrega (solicitud_id, materialid)
  WHERE solicitud_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.registrar_entrega_ciudadano(
  p_reciclador_id integer,
  p_entregas jsonb,
  p_solicitud_id uuid DEFAULT NULL
)
RETURNS SETOF integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
AS $$
DECLARE
  v_ciudadano_id INTEGER;
  v_item JSONB;
  v_material_id_texto TEXT;
  v_cantidad_texto TEXT;
  v_material_id INTEGER;
  v_cantidad NUMERIC(10, 2);
  v_materiales_vistos INTEGER[] := ARRAY[]::INTEGER[];
  v_entrega_id INTEGER;
  v_total_items INTEGER;
  v_coincidencias_recientes INTEGER;
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

  PERFORM pg_advisory_xact_lock(
    hashtext('registrar_entrega_ciudadano_' || v_ciudadano_id::text)
  );
  IF p_solicitud_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.entrega e
      WHERE e.ciudadanoid = v_ciudadano_id
        AND e.solicitud_id = p_solicitud_id
    ) THEN
      RETURN QUERY
      SELECT e.id
      FROM public.entrega e
      WHERE e.ciudadanoid = v_ciudadano_id
        AND e.solicitud_id = p_solicitud_id
      ORDER BY e.id ASC;
      RETURN;
    END IF;
  END IF;

  IF p_reciclador_id IS NULL THEN
    RAISE EXCEPTION 'Debes seleccionar un centro de reciclaje';
  END IF;

  PERFORM 1
  FROM public.reciclador r
  WHERE r.id = p_reciclador_id
    AND r.estado_validacion = 'Aprobado'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El centro de reciclaje no está aprobado o no existe';
  END IF;

  IF p_entregas IS NULL
     OR jsonb_typeof(p_entregas) <> 'array'
     OR jsonb_array_length(p_entregas) = 0 THEN
    RAISE EXCEPTION 'Debes seleccionar al menos un material con su cantidad';
  END IF;

  v_total_items := jsonb_array_length(p_entregas);

  FOR v_item IN
    SELECT elemento
    FROM jsonb_array_elements(p_entregas) AS elemento
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Formato de material no válido';
    END IF;

    v_material_id_texto := COALESCE(
      v_item ->> 'material_id',
      v_item ->> 'materialid'
    );
    v_cantidad_texto := v_item ->> 'cantidad';

    IF v_material_id_texto IS NULL
       OR v_material_id_texto !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Identificador de material no válido';
    END IF;

    IF v_cantidad_texto IS NULL
       OR v_cantidad_texto !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'La cantidad de cada material debe ser un número mayor que cero';
    END IF;

    v_material_id := v_material_id_texto::INTEGER;
    v_cantidad := ROUND(v_cantidad_texto::NUMERIC, 2);

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor que cero';
    END IF;

    IF v_material_id = ANY(v_materiales_vistos) THEN
      RAISE EXCEPTION 'No puedes registrar el mismo material más de una vez en la misma visita';
    END IF;

    v_materiales_vistos := array_append(v_materiales_vistos, v_material_id);

    IF NOT EXISTS (
      SELECT 1
      FROM public.material m
      WHERE m.id = v_material_id
    ) THEN
      RAISE EXCEPTION 'Uno de los materiales seleccionados no existe';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.material_reciclador mr
      WHERE mr.recicladorid = p_reciclador_id
        AND mr.materialid = v_material_id
    ) THEN
      RAISE EXCEPTION 'El centro seleccionado no recibe todos los materiales seleccionados';
    END IF;
  END LOOP;

  IF p_solicitud_id IS NULL THEN
    SELECT COUNT(*)
    INTO v_coincidencias_recientes
    FROM jsonb_array_elements(p_entregas) AS item
    JOIN public.entrega e
      ON e.ciudadanoid = v_ciudadano_id
     AND e.recicladorid = p_reciclador_id
     AND e.materialid = COALESCE(item ->> 'material_id', item ->> 'materialid')::INTEGER
     AND e.cantidad = ROUND((item ->> 'cantidad')::NUMERIC, 2)
     AND e.estado = 'Pendiente'
     AND e.fecha >= (CURRENT_TIMESTAMP - INTERVAL '5 seconds');

    IF v_coincidencias_recientes = v_total_items THEN
      RETURN QUERY
      SELECT e.id
      FROM public.entrega e
      WHERE e.ciudadanoid = v_ciudadano_id
        AND e.recicladorid = p_reciclador_id
        AND e.materialid = ANY(v_materiales_vistos)
        AND e.estado = 'Pendiente'
        AND e.fecha >= (CURRENT_TIMESTAMP - INTERVAL '5 seconds')
      ORDER BY e.id ASC;
      RETURN;
    END IF;
  END IF;

  FOR v_item IN
    SELECT elemento
    FROM jsonb_array_elements(p_entregas) AS elemento
  LOOP
    v_material_id := COALESCE(
      v_item ->> 'material_id',
      v_item ->> 'materialid'
    )::INTEGER;
    v_cantidad := ROUND((v_item ->> 'cantidad')::NUMERIC, 2);

    INSERT INTO public.entrega (
      cantidad,
      estado,
      puntos_acreditados,
      ciudadanoid,
      recicladorid,
      materialid,
      solicitud_id
    )
    VALUES (
      v_cantidad,
      'Pendiente',
      FALSE,
      v_ciudadano_id,
      p_reciclador_id,
      v_material_id,
      p_solicitud_id
    )
    RETURNING id INTO v_entrega_id;

    RETURN NEXT v_entrega_id;
  END LOOP;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_entrega_ciudadano(
  p_material_id integer,
  p_reciclador_id integer,
  p_cantidad numeric
)
RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
AS $$
DECLARE
  v_entrega_id INTEGER;
BEGIN
  SELECT id_creado
  INTO v_entrega_id
  FROM public.registrar_entrega_ciudadano(
    p_reciclador_id,
    jsonb_build_array(
      jsonb_build_object(
        'material_id', p_material_id,
        'cantidad', p_cantidad
      )
    ),
    NULL
  ) AS id_creado
  LIMIT 1;

  RETURN v_entrega_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_entrega_ciudadano(integer, jsonb, uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_entrega_ciudadano(integer, jsonb, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_entrega_ciudadano(integer, jsonb, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.registrar_entrega_ciudadano(integer, integer, numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_entrega_ciudadano(integer, integer, numeric) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_entrega_ciudadano(integer, integer, numeric) TO service_role;

COMMIT;
