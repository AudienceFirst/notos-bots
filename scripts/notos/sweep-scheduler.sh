#!/usr/bin/env bash
# NOTOS: Cloud Scheduler tikt elke minuut op /internal/routines/sweep van de bots-service (stap 9).
# Roept aan als notos-worker@ (heeft run.invoker op de service); de server controleert het ID-token.
set -euo pipefail
PROJECT=mge-zuid
REGION=europe-west4
SERVICE=${SERVICE:-notos-bots-staging}
JOB=${JOB:-$SERVICE-sweep}
SA=notos-worker@$PROJECT.iam.gserviceaccount.com
URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format="value(status.url)")

if gcloud scheduler jobs describe "$JOB" --project "$PROJECT" --location "$REGION" >/dev/null 2>&1; then
  VERB=update
else
  VERB=create
fi
gcloud scheduler jobs "$VERB" http "$JOB" --project "$PROJECT" --location "$REGION" \
  --schedule "* * * * *" --time-zone "Europe/Amsterdam" \
  --uri "$URL/internal/routines/sweep" --http-method POST \
  --oidc-service-account-email "$SA" --oidc-token-audience "$URL" \
  --attempt-deadline 120s

echo "scheduler $JOB: $VERB · elke minuut · $URL/internal/routines/sweep als $SA"
