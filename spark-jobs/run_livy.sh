#!/bin/bash

# Load .env variables
if [ ! -f .env ]; then
  echo "❌ .env file not found."
  exit 1
fi

# Export all variables from .env
set -a
source .env
set +a

# Required variables
required_vars=(ACCESS_KEY_ID SECRET_ACCESS_KEY SESSION_TOKEN LIVY_HOST DATABASE_SERVER DATABASE_NAME DATABASE_USER DATABASE_PASSWORD)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Required env var $var is missing"
    exit 1
  fi
done

# Construct -D spark.* options to pass as JVM arguments
args=""
for var in "${required_vars[@]}"; do
  val="${!var}"
  args+=" -Dspark.executorEnv.${var}=${val}"
  args+=" -Dspark.driverEnv.${var}=${val}"
done

# Optional: add SPARK_MASTER if not defined
args+=" -Dspark.executorEnv.SPARK_MASTER=${SPARK_MASTER:-local[*]}"
args+=" -Dspark.driverEnv.SPARK_MASTER=${SPARK_MASTER:-local[*]}"

echo "▶ Running mvn exec:java@livy with JAVA_TOOL_OPTIONS:"
echo "$args"

# Inject as JVM args
JAVA_TOOL_OPTIONS="$args" mvn exec:java@livy
