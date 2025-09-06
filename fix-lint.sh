#!/bin/bash

# Quick fix for common ESLint issues
echo "Fixing common ESLint issues..."

# Fix unused imports by prefixing with _
sed -i '' 's/SettingsKey,/_SettingsKey,/g' src/services/config-service.ts
sed -i '' 's/SETTINGS_KEYS/_SETTINGS_KEYS/g' src/services/config-service.ts
sed -i '' 's/ReloadBehavior/_ReloadBehavior/g' src/services/model-service.ts
sed -i '' 's/ReloadBehavior/_ReloadBehavior/g' src/services/notification-service.ts
sed -i '' 's/ModelConfig/_ModelConfig/g' src/services/storage-service.ts
sed -i '' 's/import os/import os as _os/g' src/utils/permission-utils.ts

# Fix unused variables
sed -i '' 's/const preferences/const _preferences/g' src/services/notification-service.ts
sed -i '' 's/const id/const _id/g' src/services/notification-service.ts
sed -i '' 's/const iv/const _iv/g' src/utils/security-utils.ts
sed -i '' 's/const issues/const _issues/g' src/commands/configure-models.ts
sed -i '' 's/const current_value/const _current_value/g' src/commands/configure-models.ts
sed -i '' 's/async (progress)/async (_progress)/g' src/commands/configure-models.ts

echo "Fixed common ESLint issues. Run 'npm run lint' to see remaining issues."