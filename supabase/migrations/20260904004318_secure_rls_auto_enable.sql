-- Impide que clientes de la API ejecuten directamente esta función privilegiada.
-- El evento interno ensure_rls podrá seguir utilizándola al crear tablas.

revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;