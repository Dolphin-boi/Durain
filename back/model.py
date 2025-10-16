from ultralytics import YOLO
from PIL import Image
import io, base64, cv2, numpy

modelNew = YOLO('modelv4.pt')
modelOld = YOLO('modelv1.pt')

class_names = ['defective', 'immature', 'mature']
colors = {
    0: (255, 0, 94),   # defective = ม่วง
    1: (255, 0, 0),   # immature = ฟ้า
    2: (0, 0, 255)    # mature = แดง
}

def predict_image(image_file, model_name):
    try:
        image_bytes = image_file.read()
        image = Image.open(io.BytesIO(image_bytes))

        if model_name == "new":
            results = modelNew.predict(image, conf=0.5)
        else:
            results = modelOld.predict(image, conf=0.5)
        
        im_array = numpy.array(image)[..., ::-1].copy()

        for r in results:
            for box, cls in zip(r.boxes.xyxy, r.boxes.cls):
                x1, y1, x2, y2 = map(int, box)
                c = int(cls)
                color = colors[c]
                label = class_names[c]

                # วาดกรอบ + ชื่อ class
                cv2.rectangle(im_array, (x1, y1), (x2, y2), color, 3)
                cv2.putText(im_array, label, (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
        
        im_rgb = cv2.cvtColor(im_array, cv2.COLOR_BGR2RGB)
        im_pil = Image.fromarray(im_rgb)

        buffered = io.BytesIO()
        im_pil.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        if not any(r.boxes.cls.numel() > 0 for r in results):
            return ("No object", img_str)
        
        return ("Found object", img_str)
        
    except Exception as e:
        return f"Error during prediction: {str(e)}", None
