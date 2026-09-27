# Change: Clean successful NAS deployments

## Why

Successful deployments retain obsolete staging and source backups indefinitely. Failure recovery still requires evidence, but a verified successful release does not.

## What Changes

- Keep the live container available while staging validation and image build run.
- Retain staging and rollback source on failure.
- Remove only Web Content Fetch deployment-owned staging and source backups after container and Gateway health checks pass.
- Preserve configuration, exported content, volumes, and user data.
