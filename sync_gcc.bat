@echo off
title Haier GCC Sync
echo.
echo  ================================================
echo   Haier Service OS - GCC Sync
echo   Visakha Customer Care Center
echo  ================================================
echo.
echo  Syncing jobs from GCC to cloud database...
echo  (This will take 2-3 minutes)
echo.

cd /d "F:\haier-service-os\backend"
python sync_to_cloud.py

echo.
echo  Done! Refresh your dashboard to see new jobs.
echo.
pause
