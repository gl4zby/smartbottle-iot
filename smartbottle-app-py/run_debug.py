"""Debug wrapper to catch and display startup errors."""
import sys
import traceback

try:
    print("[DEBUG] Starting SmartBottle app...")
    print("[DEBUG] Python version:", sys.version)
    print("[DEBUG] Importing main module...")
    
    from main import SmartBottleApp
    
    print("[DEBUG] Creating app instance...")
    app = SmartBottleApp()
    
    print("[DEBUG] Running app...")
    app.run()
    
except Exception as e:
    print("\n" + "="*60)
    print("ERROR CAUGHT:")
    print("="*60)
    print(f"Error type: {type(e).__name__}")
    print(f"Error message: {e}")
    print("\nFull traceback:")
    traceback.print_exc()
    print("="*60)
    input("\nPress ENTER to close...")
