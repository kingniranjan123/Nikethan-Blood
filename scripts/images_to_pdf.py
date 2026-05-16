import os
import glob
try:
    from PIL import Image
except ImportError:
    print("Please install Pillow first: pip install pillow")
    exit(1)

# Set the directory containing the images
client_dir = r"d:\anti-gravity-projects-II\Nikethan-Blood\Client List"
output_pdf = os.path.join(client_dir, "clients_register_compiled.pdf")

# Grab all jpeg/jpg images and sort them alphabetically to maintain chronological order
image_files = glob.glob(os.path.join(client_dir, "*.jpeg")) + glob.glob(os.path.join(client_dir, "*.jpg"))
image_files.sort()

if not image_files:
    print("No images found in the Client List directory.")
    exit(1)

print(f"Found {len(image_files)} images. Compiling into a single PDF...")

image_list = []
first_image = None

# Open and process each image
for i, img_path in enumerate(image_files):
    try:
        # Convert to RGB as required by PDF format
        img = Image.open(img_path).convert("RGB")
        if i == 0:
            first_image = img
        else:
            image_list.append(img)
    except Exception as e:
        print(f"Failed to process {img_path}: {e}")

# Save all images into a single PDF
if first_image:
    try:
        first_image.save(output_pdf, save_all=True, append_images=image_list)
        print(f"\n✅ Successfully created PDF with {len(image_files)} pages!")
        print(f"📁 Saved at: {output_pdf}")
    except Exception as e:
        print(f"\n❌ Error saving PDF: {e}")
else:
    print("\n❌ Failed to compile PDF.")
