"""Cache management for Google Sheets sync operations"""
import json
import os
from datetime import datetime, timedelta
from typing import Optional, Dict

class SyncCache:
    """Manages cache for sync operations to minimize API calls"""
    
    def __init__(self, cache_file_path: str = 'sync_cache.json', cache_expiry_seconds: int = 300):
        """
        Initialize sync cache
        
        Args:
            cache_file_path: Path to cache file
            cache_expiry_seconds: Cache expiration time in seconds (default: 5 minutes)
        """
        self.cache_file_path = cache_file_path
        self.cache_expiry_seconds = cache_expiry_seconds
        self.cache = self._load_cache()
    
    def _load_cache(self) -> Dict:
        """Load cache from file"""
        if os.path.exists(self.cache_file_path):
            try:
                with open(self.cache_file_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading cache: {e}")
                return {}
        return {}
    
    def _save_cache(self):
        """Save cache to file"""
        try:
            with open(self.cache_file_path, 'w') as f:
                json.dump(self.cache, f, indent=2, default=str)
        except Exception as e:
            print(f"Error saving cache: {e}")
    
    def get_last_sync_time(self, sync_type: str) -> Optional[datetime]:
        """Get last sync time for a specific sync type (to_sheets or from_sheets)"""
        if sync_type in self.cache:
            sync_time_str = self.cache[sync_type].get('last_sync_time')
            if sync_time_str:
                try:
                    return datetime.fromisoformat(sync_time_str)
                except:
                    return None
        return None
    
    def get_file_modification_time(self) -> Optional[str]:
        """Get stored file modification time from Google Sheets"""
        return self.cache.get('from_sheets', {}).get('file_modification_time')
    
    def set_file_modification_time(self, modification_time: str):
        """Store file modification time from Google Sheets"""
        if 'from_sheets' not in self.cache:
            self.cache['from_sheets'] = {}
        self.cache['from_sheets']['file_modification_time'] = modification_time
        self._save_cache()
    
    def should_sync(self, sync_type: str, file_modification_time: Optional[str] = None) -> bool:
        """
        Check if sync should be performed
        
        Args:
            sync_type: 'to_sheets' or 'from_sheets'
            file_modification_time: Current file modification time (for from_sheets)
        
        Returns:
            True if sync should be performed, False if cache is still valid
        """
        last_sync = self.get_last_sync_time(sync_type)
        
        if not last_sync:
            return True  # Never synced, should sync
        
        # Check if cache expired
        if datetime.now() > last_sync + timedelta(seconds=self.cache_expiry_seconds):
            return True  # Cache expired, should sync
        
        # For from_sheets, check if file was modified
        if sync_type == 'from_sheets' and file_modification_time:
            cached_mod_time = self.get_file_modification_time()
            if cached_mod_time != file_modification_time:
                return True  # File was modified, should sync
        
        return False  # Cache is still valid, skip sync
    
    def record_sync(self, sync_type: str, file_modification_time: Optional[str] = None):
        """Record that a sync was performed"""
        if sync_type not in self.cache:
            self.cache[sync_type] = {}
        
        self.cache[sync_type]['last_sync_time'] = datetime.now().isoformat()
        
        if file_modification_time:
            self.set_file_modification_time(file_modification_time)
        
        self._save_cache()
    
    def clear_cache(self):
        """Clear all cache"""
        self.cache = {}
        self._save_cache()

