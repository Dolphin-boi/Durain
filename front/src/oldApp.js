import React, { useState, useRef, useEffect } from 'react';

const API_ENDPOINT = 'http://127.0.0.1:5000/upload'; 

function SimpleImageUploader() {
    const [capturedBlob, setCapturedBlob] = useState(null); // เก็บไฟล์ภาพที่อัปโหลด/ถ่าย
    const [status, setStatus] = useState('พร้อมใช้งาน'); // แสดงสถานะการทำงาน
    const [isCameraActive, setIsCameraActive] = useState(false); // สถานะกล้อง
    const [predictionResult, setPredictionResult] = useState(null); // ผลลัพธ์การทำนาย
    const [isSending, setIsSending] = useState(false); // สถานะกำลังส่งข้อมูล

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);


    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraActive(false);
    };

    const startCamera = async () => {
        stopCamera();
        setCapturedBlob(null);
        setPredictionResult(null);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setIsCameraActive(true);
            setStatus('กล้องเปิดแล้ว 📷');
        } catch (err) {
            setStatus(`เข้าถึงกล้องไม่ได้: ${err.message}`);
        }
    };

    // A. เมื่ออัปโหลดไฟล์
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            stopCamera();
            setCapturedBlob(file);
            setPredictionResult(null);
            setStatus(`ไฟล์พร้อมส่ง: ${file.name}`);
        }
    };

    // B. เมื่อถ่ายภาพ
    const takePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (!video || !canvas) return;

        // 1. กำหนดขนาด Canvas และวาดภาพจาก Video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 2. แปลงภาพใน Canvas เป็นไฟล์ (Blob)
        canvas.toBlob((blob) => {
            // แปลง Blob เป็น File object เพื่อใช้ชื่อไฟล์ในการส่ง
            const file = new File([blob], "captured_image.jpeg", { type: "image/jpeg" });
            setCapturedBlob(file);
            stopCamera();
            setPredictionResult(null);
            setStatus('ถ่ายภาพสำเร็จ! ไฟล์พร้อมส่ง 🖼️');
        }, 'image/jpeg', 0.95);
    };

    // ----------------------------------------------------------------------
    // การส่งข้อมูลไปยัง Backend
    // ----------------------------------------------------------------------

    const sendImageToBackend = async () => {
        if (!capturedBlob) return;

        setIsSending(true);
        setStatus('กำลังส่งภาพ...');
        setPredictionResult(null);

        const formData = new FormData();
        // Key ต้องเป็น 'file' เพื่อให้ตรงกับ Flask
        formData.append('file', capturedBlob, capturedBlob.name); 

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                setPredictionResult(result.prediction || result.msg);
                setStatus(`ทำนายผลสำเร็จ ✅`);
            } else {
                setStatus(`ส่งภาพไม่สำเร็จ: ${result.error || response.statusText}`);
                setPredictionResult(null);
            }
        } catch (error) {
            setStatus(`เชื่อมต่อ Server ไม่ได้: ${error.message}`);
            setPredictionResult(null);
        } finally {
            setIsSending(false);
        }
    };
    
    // URL สำหรับภาพตัวอย่าง
    const previewUrl = capturedBlob ? URL.createObjectURL(capturedBlob) : null;

    // ----------------------------------------------------------------------
    // 4. การแสดงผล (Render)
    // ----------------------------------------------------------------------
    
    return (
        <div>
            <h1>อัปโหลดและทำนายภาพ (YOLO React)</h1>

            {/* แสดงสถานะปัจจุบัน */}
            <p><strong>สถานะ:</strong> {status}</p>
            
            <hr />

            {/* ส่วนอัปโหลดไฟล์ */}
            <h2>1. อัปโหลดไฟล์</h2>
            <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload}
                disabled={isCameraActive || isSending}
            />

            <hr />

            {/* ส่วนกล้อง */}
            <h2>2. ถ่ายภาพจากกล้อง</h2>
            
            {/* ปุ่มเปิด/ปิดกล้อง */}
            <button onClick={isCameraActive ? stopCamera : startCamera} disabled={isSending}>
                {isCameraActive ? 'ปิดกล้อง' : 'เปิดกล้อง'}
            </button>
            
            {/* ปุ่มถ่ายภาพ */}
            {isCameraActive && (
                <button onClick={takePhoto} disabled={isSending}>
                    ถ่ายภาพ
                </button>
            )}

            {/* แสดง Video Feed (ถ้ากล้องเปิด) */}
            <div style={{ marginTop: '10px' }}>
                <video 
                    ref={videoRef} 
                    autoPlay 
                    style={{ 
                        width: isCameraActive ? '100%' : '0', 
                        maxWidth: '400px',
                        display: isCameraActive ? 'block' : 'none',
                        border: '1px solid black' 
                    }}
                />
            </div>

            {/* Canvas ที่ถูกซ่อนไว้ (สำหรับจับภาพ) */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <hr />

            {/* ส่วนแสดงตัวอย่างภาพและปุ่มส่ง */}
            <h2>3. ดูตัวอย่าง & ส่งข้อมูล</h2>
            
            {previewUrl && (
                <div style={{ marginTop: '10px' }}>
                    <h3>ภาพตัวอย่าง</h3>
                    <img 
                        src={previewUrl} 
                        alt="Image Preview" 
                        style={{ maxWidth: '400px', maxHeight: '400px', display: 'block', border: '1px solid gray' }}
                    />
                    
                    {/* ปุ่มส่งข้อมูล */}
                    <button 
                        onClick={sendImageToBackend} 
                        disabled={isSending || !capturedBlob}
                        style={{ marginTop: '10px', backgroundColor: 'green', color: 'white' }}
                    >
                        {isSending ? 'กำลังส่ง...' : 'ส่งภาพทำนายผล'}
                    </button>
                </div>
            )}
            
            {/* ส่วนแสดงผลการทำนาย */}
            {predictionResult && (
                <div style={{ marginTop: '20px', padding: '10px', border: '2px solid green' }}>
                    <h3>ผลการทำนาย YOLO:</h3>
                    <p>{predictionResult}</p>
                </div>
            )}
        </div>
    );
}

export default SimpleImageUploader;