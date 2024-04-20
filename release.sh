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
# 4. The script will build the Flutter web app and upload to Firebase Cloud Functions.

# Check if an argument is provided
if [ "$#" -ne 1 ]; then
    echo "Please run either './release.sh dev' or './release.sh prod'."
    exit 1
fi

# Choose Firebase project based on argument
if [ "$1" = "dev" ]; then
    PROJECT_NAME=$DEV_PROJECT_NAME
elif [ "$1" = "prod" ]; then
    PROJECT_NAME=$PROD_PROJECT_NAME

     # Prompt for confirmation before deploying to production
    echo "You are about to deploy to PRODUCTION. Are you sure? (y/n)"
    read -r confirmation
    if [ "$confirmation" != "y" ] && [ "$confirmation" != "Y" ]; then
        echo "Deployment aborted."
        exit 1
    fi
else
    echo "Invalid environment specified. Use 'dev' or 'prod'."
    exit 1
fi

# Function to calculate command duration
calculate_duration() {
    local DURATION=$SECONDS
    let "DURATION = DURATION - $1"
    echo "Duration: $DURATION second(s)"
}

# Start script execution timer
SECONDS=0

echo "Starting deployment process..."

# Configure Firebase project
echo "Configuring Firebase project..."
START_TIME=$SECONDS
firebase use $PROJECT_NAME
calculate_duration $START_TIME
echo "Firebase project configured successfully."

# Build your Flutter web project
echo "Building project..."
START_TIME=$SECONDS
firebase deploy --only functions
calculate_duration $START_TIME
echo "Firebase Cloud Functions uploaded successfully."

# Calculate total execution time
TOTAL_DURATION=$SECONDS
echo "Total deployment process completed successfully in $TOTAL_DURATION second(s)."