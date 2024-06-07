#!/bin/bash

# RELEASE SCRIPT FOR UNIX MACHINES
#
# 1. Set the names of the Firebase projects below:

DEV_PROJECT_NAME="property-prose-dev"
PROD_PROJECT_NAME="property-prose"

# 2. Make the script executable by running this command in the terminal:
#    chmod +x release.sh
#
# 3. Run either one of the following commands:
#
#    Deploy to development:
#    ./release.sh dev
#
#    Deploy to production:
#    ./release.sh prod
#
#    Deploy specific functions to development:
#    ./release.sh dev function1 function2
#
#    Deploy specific functions to production:
#    ./release.sh prod function1 function2
#
# 4. The script will build the Flutter web app and upload to Firebase Cloud Functions.

# Enable strict error handling
# -e: Exit immediately if a command exits with a non-zero status.
# -u: Treat unset variables as an error and exit immediately.
# -o pipefail: If any command in a pipeline fails, that return code will be used as the return code of the whole pipeline.
set -euo pipefail

# Function to print error message and exit
function error_exit {
    echo "Error: $1" >&2
    exit 1
}

# Function to calculate command duration
function calculate_duration {
    local DURATION=$SECONDS
    DURATION=$((DURATION - $1))
    echo "Duration: $DURATION second(s)"
}

# Function to validate the environment
function validate_environment {
    command -v firebase >/dev/null 2>&1 || error_exit "Firebase CLI is not installed. Please install it and try again."
    command -v cp >/dev/null 2>&1 || error_exit "cp command is not available. Please ensure it's installed and try again."
}

# Function to copy the appropriate config file
function copy_config_file {
    local CONFIG_FILE=$1
    echo "Copying configuration file..."
    START_TIME=$SECONDS
    cp "./functions/values/$CONFIG_FILE" "./functions/values/config.js" || error_exit "Failed to copy configuration file."
    calculate_duration $START_TIME
    echo "Configuration file copied successfully."
}

# Function to configure Firebase project
function configure_firebase_project {
    local PROJECT_NAME=$1
    echo "Configuring Firebase project..."
    START_TIME=$SECONDS
    firebase use "$PROJECT_NAME" || error_exit "Failed to configure Firebase project."
    calculate_duration $START_TIME
    echo "Firebase project configured successfully."
}

# Function to deploy Firebase Cloud Functions
function deploy_firebase_functions {
    if [ "$#" -gt 1 ]; then
        FUNCTIONS=$(printf ",%s" "${@:2}")
        FUNCTIONS=${FUNCTIONS:1} # Remove the leading comma
        firebase deploy --only functions:$FUNCTIONS || error_exit "Failed to deploy specific Firebase Cloud Functions."
    else
        firebase deploy --only functions || error_exit "Failed to deploy Firebase Cloud Functions."
    fi
    echo "Firebase Cloud Functions uploaded successfully."
}

# Main script logic

# Validate environment
validate_environment

# Check if at least one argument is provided
if [ "$#" -lt 1 ]; then
    error_exit "Please run either './release.sh dev' or './release.sh prod' optionally followed by function names."
fi

# Choose Firebase project based on the first argument
if [ "$1" = "dev" ]; then
    PROJECT_NAME=$DEV_PROJECT_NAME
    CONFIG_FILE="config-dev.js"
elif [ "$1" = "prod" ]; then
    PROJECT_NAME=$PROD_PROJECT_NAME
    CONFIG_FILE="config-prod.js"
    
    # Prompt for confirmation before deploying to production
    echo "You are about to deploy to PRODUCTION. Are you sure? (y/n)"
    read -r confirmation
    if [ "$confirmation" != "y" ] && [ "$confirmation" != "Y" ]; then
        echo "Deployment aborted."
        exit 1
    fi
else
    error_exit "Invalid environment specified. Use 'dev' or 'prod'."
fi

# Start script execution timer
SECONDS=0

echo "Starting deployment process..."

# Copy the appropriate config file
copy_config_file "$CONFIG_FILE"

# Configure Firebase project
configure_firebase_project "$PROJECT_NAME"

# Build and deploy Firebase functions
echo "Building project..."
START_TIME=$SECONDS
deploy_firebase_functions "$@"
calculate_duration $START_TIME

# Calculate total execution time
TOTAL_DURATION=$SECONDS
echo "Total deployment process completed successfully in $TOTAL_DURATION second(s)."
