import React, { useRef, useEffect, useState } from 'react';
import treatIcon from '/running/treat.png';
import boomIcon from '/running/comics explosion Sticker.gif';
import catSpriteSheet from '/running/oneko.gif';
import boomSoundFile from '/running/vine_boom.mp3';
import { Volume2, VolumeX } from 'lucide-react';

const App = () => {
  const canvasRef = useRef(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [score, setScore] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Move your mouse to start!');
  const [randomMode, setRandomMode] = useState(false);
  const [explosions, setExplosions] = useState([]);
  const [isCursorHidden, setIsCursorHidden] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const getCatCount = () => (window.innerWidth < 768 ? 2 : 3);
  const [catCount, setCatCount] = useState(getCatCount());

  const treatImageRef = useRef(new Image());
  const catSpriteImageRef = useRef(new Image());
  const boomSoundRef = useRef(new Audio());

  const catsRef = useRef([]);
  const catSize = 60;
  const collisionDuration = 1000;
  const inactivityThreshold = 15000;

  const mousePos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const animationFrameId = useRef(null);
  const frameCount = useRef(0);
  const lastMouseMoveTime = useRef(Date.now());
  const lastOverlapState = useRef(false);
  const treatStillDelay = 250;
  const randomTreatPos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const spriteMap = {
    idle:      [{row:0,col:5},{row:0,col:6},{row:0,col:7}],
    sleep:     [{row:0,col:2},{row:1,col:2}] ,
    west:      [{row:2,col:4},{row:3,col:4}],
    southwest: [{row:1,col:6},{row:3,col:5}],
    south:     [{row:2,col:6},{row:3,col:6}],
    southeast: [{row:1,col:5},{row:2,col:5}],
    east:      [{row:0,col:3},{row:1,col:3}],
    north:     [{row:1,col:0},{row:0,col:0}],
    northwest: [{row:1,col:1},{row:0,col:1}],
    northeast: [{row:3,col:0},{row:2,col:0}]
  };
  
  const frameWidth = 32;
  const frameHeight = 32;

  const loadAssets = async () => {
    const assetPromises = [
      new Promise((resolve, reject) => {
        treatImageRef.current.onload = resolve;
        treatImageRef.current.onerror = () => reject(new Error('Failed to load treat image'));
        treatImageRef.current.src = treatIcon;
      }),
      new Promise((resolve, reject) => {
        catSpriteImageRef.current.onload = resolve;
        catSpriteImageRef.current.onerror = () => reject(new Error('Failed to load cat sprite sheet'));
        catSpriteImageRef.current.src = catSpriteSheet;
      }),
      new Promise((resolve, reject) => {
        const sound = boomSoundRef.current;
        sound.oncanplaythrough = resolve;
        sound.onerror = () => reject(new Error('Failed to load sound file'));
        sound.src = boomSoundFile;
      }),
    ];
    try {
      await Promise.all(assetPromises);
      console.log('All assets loaded successfully');
      setImagesLoaded(true);
    } catch (error) {
      console.error('Failed to load assets:', error);
    }
  };

  const playBoomSound = () => {
    if (!isMuted && boomSoundRef.current) {
      boomSoundRef.current.currentTime = 0;
      boomSoundRef.current.play().catch(error => console.log("Audio play failed:", error));
    }
  };

  const createCat = () => ({
    id: Date.now() + Math.random(),
    pos: { x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight },
    velocity: { x: 0, y: 0 },
    state: 'running',
    stateEndTime: 0,
  });

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

  const isTreatMoving = () => (Date.now() - lastMouseMoveTime.current) < treatStillDelay;
  
  const checkOverlap = () => {
    const targetPos = randomMode ? randomTreatPos.current : mousePos.current;
    let anyCatOverlapping = false;
    catsRef.current.forEach(cat => {
      if (cat.state !== 'running') return;
      const dx = targetPos.x - cat.pos.x;
      const dy = targetPos.y - cat.pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 40) anyCatOverlapping = true;
    });
    if (anyCatOverlapping && !lastOverlapState.current) {
      setScore(prev => prev + 1);
      if (randomMode) spawnRandomTreat();
    }
    lastOverlapState.current = anyCatOverlapping;
    return anyCatOverlapping;
  };
  
  const spawnRandomTreat = () => {
    randomTreatPos.current = {
      x: Math.random() * (window.innerWidth - 100) + 50,
      y: Math.random() * (window.innerHeight - 100) + 50,
    };
  };

  const updateStatusMessage = (speed, distance) => {
    const messages = {
      idle: ['Waiting for treats...', 'Just chilling', 'Ready to pounce!', 'Meow?'],
      nearTreat: ['Almost there!', 'So close!', 'Getting the treat!', 'Nom nom time!'],
      farTreat: ['Bhaaaaag.....', 'Running fast!', 'Gotta catch it!', 'Sprint mode!'],
      stillTreat: ['Treat stopped moving...', 'Should I go?', 'Waiting...', 'Hmmmm...'],
      sleeping: ['Zzz...', 'Napping...', 'Sweet dreams...','nini tiem...']
    };
    let category = 'farTreat';
    const isAnyCatSleeping = catsRef.current.some(cat => cat.state === 'sleeping');
    if (isAnyCatSleeping) {
        category = 'sleeping';
    } else if (speed < 0.5) {
        category = isTreatMoving() && !randomMode ? 'stillTreat' : 'idle';
    } else if (distance < 80) {
        category = 'nearTreat';
    }
    setStatusMessage(messages[category][Math.floor(Math.random() * messages[category].length)]);
  };

  useEffect(() => {
    loadAssets();
    const handleResize = () => setCatCount(getCatCount());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  useEffect(() => {
    if (!imagesLoaded) return;
    const currentLength = catsRef.current.length;
    if (currentLength > catCount) {
      catsRef.current.splice(catCount);
    } else if (currentLength < catCount) {
      for (let i = 0; i < catCount - currentLength; i++) {
        catsRef.current.push(createCat());
      }
    }
  }, [catCount, imagesLoaded]);

  useEffect(() => {
    if (!imagesLoaded || !isStarted) return;
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();

    const handleMouseMove = e => {
      if (!randomMode) {
        mousePos.current = { x: e.clientX, y: e.clientY };
        lastMouseMoveTime.current = Date.now();
        catsRef.current.forEach(cat => {
          if (cat.state === 'sleeping') {
            cat.state = 'running';
          }
        });
        setIsCursorHidden(false);
      }
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);
    if (randomMode) spawnRandomTreat();

    const animate = () => {
      frameCount.current++;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const targetPos = randomMode ? randomTreatPos.current : mousePos.current;
      const cats = catsRef.current;
      const isAnyCatSleeping = cats.some(cat => cat.state === 'sleeping');

      const timeSinceLastMove = Date.now() - lastMouseMoveTime.current;
      if (!randomMode && timeSinceLastMove > inactivityThreshold) {
        cats.forEach(cat => {
          if (cat.state === 'running') cat.state = 'sleeping';
        });
        setIsCursorHidden(true);
      }

      for (let i = 0; i < cats.length; i++) {
        for (let j = i + 1; j < cats.length; j++) {
          const catA = cats[i];
          const catB = cats[j];
          if (catA.state !== 'running' || catB.state !== 'running') continue;
          const dx = catB.pos.x - catA.pos.x;
          const dy = catB.pos.y - catA.pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < catSize * 0.7) {
            catA.state = 'colliding';
            catA.stateEndTime = Date.now() + collisionDuration;
            catA.velocity = { x: 0, y: 0 };
            const explosionId = Date.now() + Math.random();
            setExplosions(prev => [...prev, { id: explosionId, pos: { ...catA.pos } }]);
            setTimeout(() => setExplosions(prev => prev.filter(exp => exp.id !== explosionId)), collisionDuration);
            const bumpForce = 8;
            const normX = dx / distance || 0;
            const normY = dy / distance || 0;
            catB.velocity.x += normX * bumpForce;
            catB.velocity.y += normY * bumpForce;
            playBoomSound();
          }
        }
      }
      cats.forEach((cat, index) => {
        if (cat.state === 'colliding') {
          if (Date.now() > cat.stateEndTime) catsRef.current[index] = createCat();
          return;
        }
        if (cat.state === 'sleeping') {
          drawCat(context, cat, 0, 0, 0);
          return;
        }
        const dx = targetPos.x - cat.pos.x;
        const dy = targetPos.y - cat.pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxSpeed = 5;
        let acceleration = 0.05;
        let targetSpeed = 0;
        if (!isTreatMoving() && distance > 15) {
          targetSpeed = Math.min((distance / 100) * maxSpeed, maxSpeed);
          acceleration = distance > 100 ? 0.15 : distance > 60 ? 0.1 : 0.05;
        }
        const dirX = distance > 1 ? dx / distance : 0;
        const dirY = distance > 1 ? dy / distance : 0;
        cat.velocity.x += (targetSpeed * dirX - cat.velocity.x) * acceleration;
        cat.velocity.y += (targetSpeed * dirY - cat.velocity.y) * acceleration;
        cat.pos.x += cat.velocity.x;
        cat.pos.y += cat.velocity.y;
        const speed = Math.sqrt(cat.velocity.x ** 2 + cat.velocity.y ** 2);
        drawCat(context, cat, speed, dx, dy);
      });
      if (frameCount.current % 120 === 0) {
        const firstCat = cats[0];
        if (firstCat) {
          const dx = targetPos.x - firstCat.pos.x;
          const dy = targetPos.y - firstCat.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const speed = Math.sqrt(firstCat.velocity.x ** 2 + firstCat.velocity.y ** 2);
          updateStatusMessage(speed, dist);
        }
      }
      if (!isAnyCatSleeping) drawTreat(context);
      animationFrameId.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [imagesLoaded, randomMode, catCount, isMuted, isStarted]);

  const drawCat = (ctx, cat, speed, dx, dy) => {
    ctx.save();
    ctx.translate(cat.pos.x, cat.pos.y);
    let direction = 'idle';
    if (cat.state === 'sleeping') {
      direction = 'sleep';
    } else if (speed > 0.5) {
      direction = getDirection(dx, dy);
    }
    const frames = spriteMap[direction];
    if (!frames) return ctx.restore();
    const frameSpeed = 8;
    const frameIndex = Math.floor(frameCount.current / frameSpeed) % frames.length;
    const currentFrame = frames[frameIndex];
    const sourceX = currentFrame.col * frameWidth;
    const sourceY = currentFrame.row * frameHeight;
    const spriteSheet = catSpriteImageRef.current;
    if (spriteSheet?.complete) {
      ctx.drawImage(spriteSheet, sourceX, sourceY, frameWidth, frameHeight, -catSize / 2, -catSize / 2, catSize, catSize);
    }
    ctx.restore();
  };

  const drawTreat = (ctx) => {
    const targetPos = randomMode ? randomTreatPos.current : mousePos.current;
    if (!checkOverlap() && treatImageRef.current?.complete) {
      const treatSize = 64;
      ctx.drawImage(treatImageRef.current, targetPos.x - treatSize / 2, targetPos.y - treatSize / 2, treatSize, treatSize);
    }
  };

  const handleStart = () => {
    const sound = boomSoundRef.current;
    if (sound.paused) {
      sound.play().catch(() => {});
      sound.pause();
    }
    setIsStarted(true);
  };

  const LoadingScreen = () => (
    <div style={{ height: '100vh', width: '100vw', backgroundColor: '#000000', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#ffffff', fontSize: '18px', fontFamily: 'Arial, sans-serif' }}>
      Loading assets...
    </div>
  );

  const StartScreen = () => (
    <div onClick={handleStart} style={{ height: '100vh', width: '100vw', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#000000', fontSize: '24px', fontFamily: 'Arial, sans-serif', cursor: 'pointer' , display: 'flex', flexDirection: 'column', textAlign: 'center', padding: '20px' }}>
      Loading Mr.Billuu... <br></br>Click to Start
    </div>
  );

  if (!imagesLoaded) {
    return <LoadingScreen />;
  }

  if (!isStarted) {
    return <StartScreen />;
  }
  
  return (
    <main style={{ height: '100vh', width: '100vw', backgroundColor: '#ffffff', overflow: 'hidden', margin: 0, padding: 0, position: 'relative', cursor: isCursorHidden ? 'none' : 'auto' }}>
      
      <div style={{ position: 'absolute', top: '55px', right: '5px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '8px 12px', borderRadius: '20px', border: '2px solid #333', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Arial, sans-serif', fontSize: '12px', fontWeight: '500', color: '#333' }}>
          <span style={{ whiteSpace: 'nowrap' }}> Random Treat </span>
          <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px', cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={randomMode} onChange={() => setRandomMode(prev => !prev)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: randomMode ? '#333' : '#fff', border: '2px solid #333', borderRadius: '20px', transition: 'all 0.3s ease' }}>
              <span style={{ position: 'absolute', content: '', height: '12px', width: '12px', left: randomMode ? '20px' : '2px', bottom: '2px', backgroundColor: randomMode ? '#fff' : '#333', borderRadius: '50%', transition: 'all 0.3s ease' }} />
            </span>
          </label>
        </div>



      </div>
      
      <div style={{ position: 'absolute', top: '15px', left: '10px', color: 'black', fontSize: window.innerWidth < 400 ? '14px' : '16px', zIndex: 10 }}> Score: {score} </div>
      <div style={{ position: 'absolute', top: '15px', left: '50%', transform: 'translateX(-50%)', color: 'black', fontSize: window.innerWidth < 400 ? '13px' : '16px', zIndex: 10, maxWidth: '50%', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}> {statusMessage} </div>
      <div style={{ position: 'absolute', top: '15px', right: '10px', color: 'black', fontSize: window.innerWidth < 400 ? '14px' : '16px', zIndex: 10 }}> Ankrit </div>
      
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%'}} />

      {explosions.map(exp => (
        <img
          key={exp.id}
          src={boomIcon}
          alt="collision explosion"
          style={{
            position: 'absolute',
            left: exp.pos.x,
            top: exp.pos.y,
            width: '110px',
            height: '110px',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        />
      ))}
    </main>
  );
};

export default App;