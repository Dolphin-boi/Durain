from ultralytics import YOLO
from PIL import Image
import io, base64, cv2, numpy, os

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
    
def predict_video(video_file, model_name, path):
    try:
        temp_input_path = "temp_input_" + video_file.filename
        video_file.save(temp_input_path)

        cap = cv2.VideoCapture(temp_input_path)
        if not cap.isOpened():
            raise ValueError("Could not open video file.")

        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)

        output_name = f"predicted_{os.urandom(16).hex()}.mp4"
        
        path_to_save = os.path.join(path, output_name) 
        
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        out = cv2.VideoWriter(path_to_save, fourcc, fps, (frame_width, frame_height))

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if model_name == "new":
                results = modelNew.predict(frame, conf=0.5, verbose=False)
            else:
                results = modelOld.predict(frame, conf=0.5, verbose=False)

            for r in results:
                for box, cls in zip(r.boxes.xyxy, r.boxes.cls):
                    x1, y1, x2, y2 = map(int, box)
                    c = int(cls)
                    color = colors[c]
                    label = class_names[c]

                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
                    cv2.putText(frame, label, (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
            
            out.write(frame)

        cap.release()
        out.release()
        os.remove(temp_input_path)
        
        return ("ผลลัพธ์การตรวจจับ", output_name)

    except Exception as e:
        if 'temp_input_path' in locals() and os.path.exists(temp_input_path): os.remove(temp_input_path)
        if 'temp_output_filename' in locals() and os.path.exists(path_to_save): os.remove(path_to_save)

        return (f"Error during video prediction: {str(e)}", None)
    finally:
        if cap is not None:
            cap.release()
        if out is not None:
            out.release()
        if temp_input_path and os.path.exists(temp_input_path):
            os.remove(temp_input_path)
