#!/usr/bin/env bash
# NOTOS: notos-bots-staging op Cloud Run (bouwplan stap 4). Eerst de migratie, dan dit, dan de worker.
# De image komt uit cloudbuild.yaml; de secrets staan in Secret Manager (europe-west4).
set -euo pipefail
PROJECT=mge-zuid
REGION=europe-west4
SERVICE=${SERVICE:-notos-bots-staging}
IMAGE=europe-west4-docker.pkg.dev/$PROJECT/mge/notos-bots:latest

gcloud run deploy "$SERVICE" --project "$PROJECT" --region "$REGION" \
  --image "$IMAGE" \
  --service-account notos-bots@$PROJECT.iam.gserviceaccount.com \
  --no-allow-unauthenticated \
  --memory 4Gi --cpu 2 --min-instances 0 --max-instances 3 --concurrency 40 --port 3001 \
  --set-env-vars "^|^SUPABASE_URL=https://ytggthdjbqauxagxahey.supabase.co|SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0Z2d0aGRqYnFhdXhhZ3hhaGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxOTc4OTcsImV4cCI6MjA5Nzc3Mzg5N30.rTVUvuv8Xvi420QYCOv13Sq30jctXOclYKgkI2Y-Y9g|NOTOS_API_URL=https://mge-cockpit-api-he4zloymzq-ez.a.run.app|GOOGLE_VERTEX_PROJECT=$PROJECT|VERTEX_LOCATION=europe-west4|MODEL_DEFAULT=gemini-2.5-pro|DATABASE_SCHEMA=bots_staging|TRUSTED_ORIGINS=https://notos.zuid.com|OPENBOT_PUBLIC_URL=https://notos.zuid.com/api/bots|OPENBOT_APP_URL=https://notos.zuid.com/bots|COPILOTKIT_TELEMETRY_DISABLED=true|DO_NOT_TRACK=1|AI_SDK_LOG_WARNINGS=false" \
  --set-secrets "DATABASE_URL=notos-bots-staging-database-url:latest,KEY_ENCRYPTION_KEY=notos-bots-key-encryption-key:latest,WORKER_SHARED_SECRET=notos-bots-worker-shared-secret:latest,AGENT_TOOL_TOKEN=notos-bots-agent-tool-token:latest"

# De deploy-output toont de revisie mét verkeer, niet de nieuwe; altijd expliciet doorzetten en nalezen.
gcloud run services update-traffic "$SERVICE" --project "$PROJECT" --region "$REGION" --to-latest
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format="value(status.url,status.traffic)"
