# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Change to the directory where the script is located
cd "$(dirname "$0")"

# If .env does not exist, copy .env.example to .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo ".env file does not exist, copied from .env.example."
else
    echo ".env file already exists, no need to copy."
fi

CLOUD_PROVIDER_VALUE=""
if [ -f .env ]; then
    CLOUD_PROVIDER_VALUE=$(grep -E '^CLOUD_PROVIDER=' .env | cut -d '=' -f2- | tr -d '\"\\')
fi

# Build docker image with CLOUD_PROVIDER as build-arg if set
if [ -n "$CLOUD_PROVIDER_VALUE" ]; then
    sudo docker build --build-arg CLOUD_PROVIDER="$CLOUD_PROVIDER_VALUE" -t bt9debian12img:latest .
else
    sudo docker build -t bt9debian12img:latest .
fi

sudo docker stop bt9debian12 
sudo docker rm bt9debian12 
sudo docker run -d --name bt9debian12 bt9debian12img:latest 
sudo docker logs -f bt9debian12 
COMMAND_EXEC="sudo docker exec -it bt9debian12 bash"
echo $COMMAND_EXEC