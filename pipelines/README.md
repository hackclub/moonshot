# Moonshot Pipelines

Automated jobs for Moonshot data synchronization and maintenance.

## Building the Pipeline Image

```bash
docker build -f pipelines/Dockerfile -t moonshot-pipelines:latest .
```

## Running Jobs Manually

### Hackatime Sync

The hackatime-sync job synchronizes Hackatime hours with the database.

#### Required Environment Variables

Create a `.env` file in the project root with:

- `DATABASE_URL`: PostgreSQL connection string
- `HACKATIME_API_TOKEN`: Standard Hackatime API token
- `HACKATIME_RACK_ATTACK_BYPASS_TOKEN` (optional): Bypass token for rate limiting
- `HACKATIME_API_URL` (optional): Custom Hackatime API URL (defaults to https://hackatime.hackclub.com/api)

#### Running Interactively (Recommended)

```bash
# 1. Navigate to project root and start an interactive container with your .env loaded
cd /path/to/moonshot  # Navigate to your project root
docker run -it --rm --env-file .env --entrypoint /bin/sh moonshot-pipelines:latest

# 2. Inside the container, run a dry run first (recommended)
cd /app && tsx /app/pipelines/jobs/hackatime-sync/hackatime-sync.ts --dry-run

# 3. If the dry run looks good, run it for real (exactly as crontab does)
cd /app && tsx /app/pipelines/jobs/hackatime-sync/hackatime-sync.ts
```

The dry run will show you what changes would be made WITHOUT actually updating the database, including negative deltas when hours decrease.

#### One-Shot Commands

If you prefer non-interactive execution:

```bash
# Dry run
docker run --rm \
  --env-file .env \
  moonshot-pipelines:latest \
  sh -c "cd /app && tsx /app/pipelines/jobs/hackatime-sync/hackatime-sync.ts --dry-run"

# Live run
docker run --rm \
  --env-file .env \
  moonshot-pipelines:latest \
  sh -c "cd /app && tsx /app/pipelines/jobs/hackatime-sync/hackatime-sync.ts"
```

## Available Jobs

### hackatime-sync
**Purpose**: Synchronizes Hackatime hours with the database  
**Script**: `pipelines/jobs/hackatime-sync/hackatime-sync.ts`  
**Schedule**: Every 5 minutes (when enabled in crontab)  
**Dry Run Support**: ✅ Yes

### airtable-rsvp
**Purpose**: Updates Airtable with RSVP information  
**Script**: `pipelines/jobs/airtable-rsvp/update-airtable-rsvp.ts`  
**Schedule**: Every 10 minutes (when enabled in crontab)

### airtable-sync
**Purpose**: Synchronizes data with Airtable  
**Script**: `pipelines/jobs/airtable-sync/index.ts`  
**Schedule**: Every 15 minutes (when enabled in crontab)

### badge-verification
**Purpose**: Verifies repository badges  
**Script**: `pipelines/jobs/badge-verification/index.ts`  
**Schedule**: Every 30 minutes (when enabled in crontab)

### duplicate-tagger
**Purpose**: Tags duplicate entries  
**Script**: `pipelines/jobs/duplicate-tagger/index.ts`  
**Schedule**: Every 10 minutes (when enabled in crontab)

### ip2geo
**Purpose**: Converts IP addresses to geographic locations  
**Script**: `pipelines/jobs/ip2geo/ip2geo.py`  
**Schedule**: Every minute (when enabled in crontab)

## Running in Production

The pipeline container runs cron jobs as defined in `pipelines/crontab`. Jobs are currently commented out. To enable them, uncomment the desired jobs in the crontab file and rebuild the image.

```bash
# Build the image
docker build -f pipelines/Dockerfile -t moonshot-pipelines:latest .

# Run the container (will run cron jobs automatically)
# Using --env-file to load all environment variables
docker run -d \
  --name moonshot-pipelines \
  --env-file .env \
  moonshot-pipelines:latest

# Or specify individual environment variables
docker run -d \
  --name moonshot-pipelines \
  -e DATABASE_URL="$DATABASE_URL" \
  -e HACKATIME_API_TOKEN="$HACKATIME_API_TOKEN" \
  -e HACKATIME_RACK_ATTACK_BYPASS_TOKEN="$HACKATIME_RACK_ATTACK_BYPASS_TOKEN" \
  -e AIRTABLE_API_KEY="$AIRTABLE_API_KEY" \
  -e AIRTABLE_BASE_ID="$AIRTABLE_BASE_ID" \
  moonshot-pipelines:latest
```

## Troubleshooting

### Checking logs

```bash
docker logs moonshot-pipelines
```

### Testing connectivity

```bash
docker exec -it moonshot-pipelines sh -c "cd /app && tsx /app/pipelines/jobs/hackatime-sync/hackatime-sync.ts --dry-run"
```


