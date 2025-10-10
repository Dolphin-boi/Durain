from ultralytics import YOLO
from PIL import Image
import io
import numpy

import base64

MODEL = YOLO('yolov8n.pt')
# MODEL = YOLO('path/to/your/best.pt')

def predict_image(image_file):
    try:
        # image_bytes = image_file.read()
        # image = Image.open(io.BytesIO(image_bytes))
        
        # results = MODEL.predict(image, conf=0.25, iou=0.7)
        
        # predictions = []
        # for r in results:
        #     names = r.names
            
        #     for class_id in r.boxes.cls:
        #         class_name = names[int(class_id)]
        #         predictions.append(class_name)
        
        # if not predictions:
        #     return "No object detected"
        

        # unique_predictions = ", ".join(sorted(list(set(predictions))))
        
        # return unique_predictions
        
        image_bytes = image_file.read()
        image = Image.open(io.BytesIO(image_bytes))

        results = MODEL.predict(image, conf=0.25, iou=0.7)
        
        if not any(r.boxes.cls.numel() > 0 for r in results): # numel() คือจำนวน element ใน tensor
            return "No object detected"
            
        im_array = results[0].plot()  # ได้ NumPy array (BGR format)
        
        im = Image.fromarray(im_array[..., ::-1])  # BGR to RGB
        
        buffered = io.BytesIO()
        im.save(buffered, format="PNG") # หรือ JPEG หากต้องการ
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return img_str
        
    except Exception as e:
        return f"Error during prediction: {str(e)}"
