\restrict oW3loS0OyteFi3DtYH6Kqv05PHlTh7gv2S9LgSl8fQjby4btBKsB6wOOQQa9wQY

CREATE TABLE public.effect_sql_migrations (
    migration_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL
);

CREATE TABLE public."user" (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_id_seq OWNED BY public."user".id;

ALTER TABLE ONLY public."user" ALTER COLUMN id SET DEFAULT nextval('public.user_id_seq'::regclass);

ALTER TABLE ONLY public.effect_sql_migrations
    ADD CONSTRAINT effect_sql_migrations_pkey PRIMARY KEY (migration_id);

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);

\unrestrict oW3loS0OyteFi3DtYH6Kqv05PHlTh7gv2S9LgSl8fQjby4btBKsB6wOOQQa9wQY

\restrict 321BU97Je6NjlRkiIf33jwbtJ58jiTejYkcL4LFR8WuFHzPpgRutspaZC6WRLhf

INSERT INTO public.effect_sql_migrations (migration_id, created_at, name) VALUES (1, '2025-10-16 22:19:08.306033+00', 'create_tables');

\unrestrict 321BU97Je6NjlRkiIf33jwbtJ58jiTejYkcL4LFR8WuFHzPpgRutspaZC6WRLhf