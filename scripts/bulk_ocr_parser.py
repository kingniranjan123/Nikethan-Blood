import os
import glob
import time
import google.generativeai as genai
from PIL import Image

# Setup API Key
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY environment variable not found.")
    print("Please set it using: setx GEMINI_API_KEY 'your_api_key' in PowerShell, then restart terminal.")
    exit(1)

genai.configure(api_key=API_KEY)

# Use Gemini 1.5 Pro for best tabular vision extraction
model = genai.GenerativeModel('gemini-1.5-pro')

prompt = """
Extract the table of patient records from this handwritten register image.
Return ONLY valid CSV format with no markdown formatting or backticks.
The columns should strictly be:
Date,Name,Age,Gender,Phone,Package,Address,Status

Guidelines:
- Date: Convert to DD/MM/YYYY format if possible.
- Gender: Use 'M' for Male and 'F' for Female.
- Status: Default to 'Active'.
- If Address is not visible, leave it empty.
- Do NOT include the header row in your output. Just the data rows.
"""

client_dir = r"d:\anti-gravity-projects-II\Nikethan-Blood\Client List"
output_csv = os.path.join(client_dir, "clients.csv")
image_files = glob.glob(os.path.join(client_dir, "*.jpeg")) + glob.glob(os.path.join(client_dir, "*.jpg"))

print(f"Found {len(image_files)} images to process.")

with open(output_csv, "a", encoding="utf-8") as f:
    for i, img_path in enumerate(image_files):
        print(f"Processing image {i+1}/{len(image_files)}: {os.path.basename(img_path)}...")
        try:
            img = Image.open(img_path)
            response = model.generate_content([prompt, img])
            
            # Clean up the output to ensure it's pure CSV
            csv_data = response.text.strip().replace('```csv', '').replace('```', '').strip()
            
            if csv_data:
                f.write(csv_data + "\n")
                f.flush()
                print("  -> Success!")
            else:
                print("  -> No data found.")
                
            # Sleep to respect rate limits
            time.sleep(3)
            
        except Exception as e:
            print(f"  -> Error processing {os.path.basename(img_path)}: {e}")

print(f"Finished processing all {len(image_files)} images.")
print(f"Data appended to {output_csv}.")
