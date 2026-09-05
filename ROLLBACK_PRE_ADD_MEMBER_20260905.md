# Production rollback marker

VCCF Connect production was restored to the last known-good code state immediately before the Add Member feature was introduced.

Baseline commit: `52271fd9fe6c20877733c2c98ed36dc17d2a7d1c`

The later Add Member and authentication experiments are preserved on branch `backup/add-member-auth-20260905`.
