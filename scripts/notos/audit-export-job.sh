#!/usr/bin/env bash
# NOTOS: Cloud Run Job + Cloud Scheduler voor de nachtelijke audit-export naar BigQuery (stap 5).
# Zelfde image als de service; commando overschrijft /init, dus geen browser en geen API, alleen bun.
# Draai na een build; idempotent (create of update).
set -euo pipefail
PROJECT=mge-zuid
REGION=europe-west4
JOB=${JOB:-notos-bots-audit-export}
SCHEMA=${DATABASE_SCHEMA:-bots_staging}
IMAGE=europe-west4-docker.pkg.dev/$PROJECT/mge/notos-bots:latest
SA=notos-bots@$PROJECT.iam.gserviceaccount.com
TABLE=${BQ_TABLE:-mge-zuid.marts.bots_audit}

if gcloud run jobs describe "$JOB" --project "$PROJECT" --region "$REGION" >/dev/null 2>&1; then
  VERB=update
else
  VERB=create
fi
gcloud run jobs "$VERB" "$JOB" --project "$PROJECT" --region "$REGION" \
  --image "$IMAGE" \
  --service-account "$SA" \
  --command bun --args /app/server/src/notos/audit-export.ts \
  --memory 1Gi --cpu 1 --max-retries 1 --task-timeout 10m \
  --set-env-vars "DATABASE_SCHEMA=$SCHEMA,BQ_TABLE=$TABLE,COPILOTKIT_TELEMETRY_DISABLED=true,DO_NOT_TRACK=1" \
  --set-secrets "DATABASE_URL=notos-bots-staging-database-url:latest"

# De scheduler roept de job aan als notos-bots@; daarvoor is run.jobs.run op de job nodig.
gcloud run jobs add-iam-policy-binding "$JOB" --project "$PROJECT" --region "$REGION" \
  --member "serviceAccount:$SA" --role roles/run.invoker >/dev/null

URI="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT/jobs/$JOB:run"
if gcloud scheduler jobs describe "$JOB" --project "$PROJECT" --location "$REGION" >/dev/null 2>&1; then
  SVERB=update
else
  SVERB=create
fi
gcloud scheduler jobs "$SVERB" http "$JOB" --project "$PROJECT" --location "$REGION" \
  --schedule "30 2 * * *" --time-zone "Europe/Amsterdam" \
  --uri "$URI" --http-method POST \
  --oauth-service-account-email "$SA"

echo "job $JOB: $VERB · scheduler: $SVERB · elke nacht 02:30 Europe/Amsterdam · tabel $TABLE"
