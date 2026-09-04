# Workspaces

Eén map per NOTOS-klant, met de naam van de `client_id` uit NOTOS (`zoover`, `youp-sleeps`, ...).
Elke map mag `agents.yaml`, `channels.yaml` en `skills.yaml` bevatten, in hetzelfde formaat als
het tenantpakket van OpenBot (`docs/configuration.md`, "Tenant package"). Ontbreekt een map of
een bestand, dan geldt `_default/`.

`_default/agents.yaml` wordt gegenereerd uit de MGE-rollen: `bun scripts/notos/agents-from-mge.ts`.
Bewerk dat bestand niet met de hand.

Bot- en kanaal-id's uit een pakket krijgen bij het laden de workspace als voorvoegsel
(`zoover--media-manager`), zodat twee workspaces hetzelfde pakket kunnen delen.
