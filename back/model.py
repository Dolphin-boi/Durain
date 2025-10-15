from ultralytics import YOLO
from PIL import Image
import io

import base64

modelNew = YOLO('modelv4.pt')
modelOld = YOLO('modelv1.pt')

def predict_image(image_file, model_name):
    try:
        image_bytes = image_file.read()
        image = Image.open(io.BytesIO(image_bytes))

        if model_name == "new":
            results = modelNew.predict(image, conf=0.5)
        else:
            results = modelOld.predict(image, conf=0.5)
            
        im_array = results[0].plot()  # ได้ NumPy array (BGR format)
        
        img = Image.fromarray(im_array[..., ::-1])
        
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        if not any(r.boxes.cls.numel() > 0 for r in results):
            return ("No object", img_str)
        
        return ("Found object", img_str)
        
    except Exception as e:
        return f"Error during prediction: {str(e)}", None
