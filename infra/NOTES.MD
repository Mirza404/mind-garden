# Install GitHub CLI if needed

gh auth login

# Create secrets from your .env files

gh secret set --env-file frontend/.env
gh secret set --env-file backend/.env

docker rm -f mind-garden-backend mind-garden-frontend
docker rmi -f elhanm/mind-garden-backend:latest elhanm/mind-garden-frontend:latest

./infra/build-and-push.sh
sudo ./infra/terraform/deploy.sh
sudo ./infra/terraform/destroy.sh

# Store the complete contents of your frontend .env file as a secure string

aws ssm put-parameter \
 --name "/mind-garden/frontend/env" \
 --type "SecureString" \
 --value "$(cat frontend/.env)" \
 --region eu-north-1 \
 --overwrite

# Store the complete contents of your backend .env file as a secure string

aws ssm put-parameter \
 --name "/mind-garden/backend/env" \
 --type "SecureString" \
 --value "$(cat backend/.env)" \
 --region eu-north-1 \
 --overwrite
