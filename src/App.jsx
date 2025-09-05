import React, { useRef, useEffect, useState } from 'react';
import treatIcon from '/running/treat.png';

const App = () => {
  const canvasRef = useRef(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [score, setScore] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Move your mouse to start!');
  const [randomMode, setRandomMode] = useState(false); // <-- Toggle state

  const treatImageRef = useRef(new Image());

  // Animation state refs
  const mousePos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const catPos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const catVelocity = useRef({ x: 0, y: 0 });
  const animationFrameId = useRef(null);
  const frameCount = useRef(0);
  const images = useRef({});
  const lastMouseMoveTime = useRef(Date.now());
  const lastOverlapState = useRef(false);
  const treatStillDelay = 250;

  // For random mode
  const randomTreatPos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const lastRandomSpawn = useRef(Date.now());
  const randomSpawnInterval = 2000; // spawn new treat every 2 seconds

  const imageUrls = {
    north: ['/running/image.png', '/running/image copy.png'],
    northeast: ['/running/image copy 2.png', '/running/image copy 3.png'],
    east: ['/running/image copy 4.png', '/running/image copy 5.png'],
    southeast: ['/running/image copy 6.png', '/running/image copy 7.png'],
    south: ['/running/image copy 8.png', '/running/image copy 9.png'],
    southwest: ['/running/image copy 10.png', '/running/image copy 11.png'],
    west: ['/running/image copy 11.png', '/running/image copy 12.png'],
    northwest: ['/running/image copy 13.png', '/running/image copy 14.png'],
    idle: ['/running/image copy 15.png', '/running/image copy 16.png', '/running/image copy 17.png'],
  };

  const loadImages = async () => {
    const imagePromises = [];
    Object.keys(imageUrls).forEach((direction) => {
      images.current[direction] = [];
      imageUrls[direction].forEach((url, index) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const promise = new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load: ${url}`));
        });
        img.src = url;
        images.current[direction][index] = img;
        imagePromises.push(promise);
      });
    });

    const treatPromise = new Promise((resolve, reject) => {
      treatImageRef.current.onload = () => resolve();
      treatImageRef.current.onerror = () => reject(new Error('Failed to load treat image'));
      treatImageRef.current.src = treatIcon;
    });
    imagePromises.push(treatPromise);

    try {
      await Promise.all(imagePromises);
      console.log('All images loaded successfully');
      setImagesLoaded(true);
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  };

  const getDirection = (dx, dy) => {
    const angle = Math.atan2(dy, dx);
    const degrees = ((angle * 180) / Math.PI + 360) % 360;

    if (degrees >= 337.5 || degrees < 22.5) return 'east';
    if (degrees >= 22.5 && degrees < 67.5) return 'southeast';
    if (degrees >= 67.5 && degrees < 112.5) return 'south';
    if (degrees >= 112.5 && degrees < 157.5) return 'southwest';
    if (degrees >= 157.5 && degrees < 202.5) return 'west';
    if (degrees >= 202.5 && degrees < 247.5) return 'northwest';
    if (degrees >= 247.5 && degrees < 292.5) return 'north';
    if (degrees >= 292.5 && degrees < 337.5) return 'northeast';
    return 'east';
  };

  const isTreatMoving = () => {
    const now = Date.now();
    return (now - lastMouseMoveTime.current) < treatStillDelay;
  };

  const checkOverlap = () => {
    const targetPos = randomMode ? randomTreatPos.current : mousePos.current;
    const dx = targetPos.x - catPos.current.x;
    const dy = targetPos.y - catPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const isOverlapping = distance < 40;

    if (isOverlapping && !lastOverlapState.current) {
      setScore(prev => prev + 1);

      // Move treat to new random spot in random mode
      if (randomMode) {
        spawnRandomTreat();
      }
    }
    lastOverlapState.current = isOverlapping;

    return isOverlapping;
  };

  const spawnRandomTreat = () => {
    randomTreatPos.current = {
      x: Math.random() * (window.innerWidth - 100) + 50,
      y: Math.random() * (window.innerHeight - 100) + 50
    };
    lastRandomSpawn.current = Date.now();
  };

  const updateStatusMessage = (speed, distance) => {
    const messages = {
      idle: ['Waiting for treats...', 'Just chilling', 'Ready to pounce!', 'Meow?'],
      nearTreat: ['Almost there!', 'So close!', 'Getting the treat!', 'Nom nom time!'],
      farTreat: ['Chasing treat!', 'Running fast!', 'Gotta catch it!', 'Sprint mode!'],
      stillTreat: ['Treat stopped moving...', 'Should I go?', 'Waiting...', 'Hmm...']
    };

    let category;
    if (speed < 0.5) {
      if (isTreatMoving() && !randomMode) {
        category = 'stillTreat';
      } else {
        category = 'idle';
      }
    } else if (distance < 80) {
      category = 'nearTreat';
    } else {
      category = 'farTreat';
    }

    const randomMessage = messages[category][Math.floor(Math.random() * messages[category].length)];
    setStatusMessage(randomMessage);
  };

  const drawWithTransparency = (ctx, img, x, y, size) => {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = size;
    offCanvas.height = size;
    const offCtx = offCanvas.getContext('2d');

    offCtx.drawImage(img, 0, 0, size, size);
    const imageData = offCtx.getImageData(0, 0, size, size);
    const data = imageData.data;

    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

      if (dist < 50) {
        data[i + 3] = (dist / 50) * data[i + 3];
      }
    }

    offCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(offCanvas, x, y, size, size);
  };

  useEffect(() => {
    loadImages();
  }, []);

  useEffect(() => {
    if (!imagesLoaded) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();

    const handleMouseMove = (event) => {
      if (!randomMode) {
        mousePos.current = { x: event.clientX, y: event.clientY };
        lastMouseMoveTime.current = Date.now();
      }
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);

    if (randomMode) spawnRandomTreat();

    const animate = () => {
      frameCount.current++;

      const targetPos = randomMode ? randomTreatPos.current : mousePos.current;
      const dx = targetPos.x - catPos.current.x;
      const dy = targetPos.y - catPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const maxSpeed = 5;
      let acceleration = 0.05;
      let targetSpeed = 0;

      if (!isTreatMoving() && distance > 15) {
        targetSpeed = Math.min((distance / 100) * maxSpeed, maxSpeed);
        if (distance > 100) acceleration = 0.15;
        else if (distance > 60) acceleration = 0.1;
      }

      const dirX = distance > 1 ? dx / distance : 0;
      const dirY = distance > 1 ? dy / distance : 0;

      catVelocity.current.x += (targetSpeed * dirX - catVelocity.current.x) * acceleration;
      catVelocity.current.y += (targetSpeed * dirY - catVelocity.current.y) * acceleration;

      catPos.current.x += catVelocity.current.x;
      catPos.current.y += catVelocity.current.y;

      const speed = Math.sqrt(
        catVelocity.current.x * catVelocity.current.x + catVelocity.current.y * catVelocity.current.y
      );

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      if (frameCount.current % 120 === 0) {
        updateStatusMessage(speed, distance);
      }

      drawTreat(context);
      drawCat(context, speed, dx, dy, distance);

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [imagesLoaded, randomMode]);

  const drawCat = (ctx, speed, dx, dy, distance) => {
    ctx.save();
    ctx.translate(catPos.current.x, catPos.current.y);

    let direction, frameIndex;

    if (speed < 0.5) {
      direction = 'idle';
      frameIndex = Math.floor(frameCount.current / 45) % 3;
    } else {
      direction = getDirection(dx, dy);
      let frameSpeed = distance > 150 ? 8 : distance > 100 ? 12 : 15;
      frameIndex = Math.floor(frameCount.current / frameSpeed) % 2;
    }

    const img = images.current[direction]?.[frameIndex];
    if (img && img.complete) {
      const size = 60;
      drawWithTransparency(ctx, img, -size / 2, -size / 2, size);
    }

    ctx.restore();
  };

  const drawTreat = (ctx) => {
    const targetPos = randomMode ? randomTreatPos.current : mousePos.current;
    if (!checkOverlap() && treatImageRef.current && treatImageRef.current.complete) {
      const treatSize = 64;
      ctx.drawImage(treatImageRef.current, targetPos.x - treatSize / 2, targetPos.y - treatSize / 2, treatSize, treatSize);
    }
  };

  if (!imagesLoaded) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: '#000000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#ffffff',
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
      }}>
        Loading cat images...
      </div>
    );
  }

  return (
    <main style={{ height: '100vh', width: '100vw', backgroundColor: '#000000', overflow: 'hidden', margin: 0, padding: 0, position: 'relative' }}>
      
      {/* Mobile-responsive toggle switch */}
      <div style={{ 
        position: 'absolute', 
        top:"75px",

        right: '5px', 
        zIndex: 10, 
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '8px 12px',
        borderRadius: '20px',
        border: '2px solid #333',
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        fontWeight: '500',
        color: '#333',
        maxWidth: 'calc(100vw - 40px)',
        boxSizing: 'border-box'
      }}>
        <span style={{ 
          whiteSpace: 'nowrap',
          fontSize: window.innerWidth < 400 ? '11px' : '12px'
        }}>
          {window.innerWidth < 400 ? 'Random' : 'Random Mode'}
        </span>
        <label style={{ 
          position: 'relative', 
          display: 'inline-block', 
          width: '36px', 
          height: '20px',
          cursor: 'pointer',
          flexShrink: 0
        }}>
          <input 
            type="checkbox" 
            checked={randomMode} 
            onChange={() => setRandomMode(prev => !prev)}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: randomMode ? '#333' : '#fff',
            border: '2px solid #333',
            borderRadius: '20px',
            transition: 'all 0.3s ease'
          }}>
            <span style={{
              position: 'absolute',
              content: '',
              height: '12px',
              width: '12px',
              left: randomMode ? '20px' : '2px',
              bottom: '2px',
              backgroundColor: randomMode ? '#fff' : '#333',
              borderRadius: '50%',
              transition: 'all 0.3s ease'
            }} />
          </span>
        </label>
      </div>

      {/* Top UI elements - also made mobile responsive */}
      <div style={{ 
        position: 'absolute', 
        top: '15px', 
        left: '10px', 
        color: 'black', 
        fontSize: window.innerWidth < 400 ? '14px' : '16px', 
        zIndex: 10 
      }}>
        Score: {score}
      </div>
      
      <div style={{ 
        position: 'absolute', 
        top: '15px', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        color: 'black', 
        fontSize: window.innerWidth < 400 ? '13px' : '16px', 
        zIndex: 10,
        maxWidth: '50%',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {statusMessage}
      </div>
      
      <div style={{ 
        position: 'absolute', 
        top: '15px', 
        right: '10px', 
        color: 'black', 
        fontSize: window.innerWidth < 400 ? '14px' : '16px', 
        zIndex: 10 
      }}>
       Ankrit 
      </div>
      
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', cursor: 'none' }} />
    </main>
  );
};

export default App;