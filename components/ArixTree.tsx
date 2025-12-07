import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { CONFIG, COLORS } from '../constants';
import { TreeMorphState } from '../types';
import { getRandomSpherePoint, getTreePoint, generateRandomRotation, getRandomPaletteColor } from '../utils/geometry';

interface ArixTreeProps {
  targetState: TreeMorphState;
  handData?: { rotation: number; x: number; y: number; isDetected: boolean };
}

const dummy = new THREE.Object3D();
const tempVec3 = new THREE.Vector3();
const tempColor = new THREE.Color();

// Define geometry layers
const LAYERS = ['box', 'sphere', 'dodecahedron', 'tetrahedron'] as const;
const COUNTS_PER_LAYER = Math.floor(CONFIG.PARTICLE_COUNT / LAYERS.length);

const CustomStar = ({ innerRadius, outerRadius, depth, count, ...props }: any) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const step = Math.PI / count;
    for (let i = 0; i < 2 * count; i++) {
      // For a standard pentagram with 36 degree tips, ratio is ~0.382
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const a = i * step;
      const x = r * Math.sin(a);
      const y = r * Math.cos(a);
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  }, [innerRadius, outerRadius, count]);

  const extrudeSettings = useMemo(() => ({ depth, bevelEnabled: false }), [depth]);

  return (
    <mesh {...props}>
      <extrudeGeometry args={[shape, extrudeSettings]} />
      {props.children}
    </mesh>
  );
};

// Snow Particles (Falling white glowing particles)
const SnowParticles = () => {
  const count = 3000; 
  const meshRef = useRef<THREE.Points>(null);

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const r = Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      pos[i * 3] = r * Math.cos(theta); // x
      pos[i * 3 + 1] = Math.random() * 60 - 30; // y
      pos[i * 3 + 2] = r * Math.sin(theta); // z
      
      vel[i * 3] = (Math.random() - 0.5) * 0.5;
      vel[i * 3 + 1] = -(Math.random() * 0.05 + 0.05);
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    return [pos, vel];
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const posAttribute = meshRef.current.geometry.attributes.position;
    const currentPositions = posAttribute.array as Float32Array;

    for (let i = 0; i < count; i++) {
      currentPositions[i * 3 + 1] += velocities[i * 3 + 1];
      currentPositions[i * 3] += velocities[i * 3];
      currentPositions[i * 3 + 2] += velocities[i * 3 + 2];

      if (currentPositions[i * 3 + 1] < -30) {
        currentPositions[i * 3 + 1] = 30;
        const r = Math.random() * 40;
        const theta = Math.random() * Math.PI * 2;
        currentPositions[i * 3] = r * Math.cos(theta);
        currentPositions[i * 3 + 2] = r * Math.sin(theta);
      }
    }
    posAttribute.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.15} color="#ffffff" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation={true} />
    </points>
  );
};

// Ambient Background Particles
const AmbientParticles = () => {
  const count = 2000;
  const meshRef = useRef<THREE.Points>(null);

  const [positions] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 45 + Math.random() * 45;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return [pos];
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    meshRef.current.rotation.y = time * 0.03;
    const opacity = 0.3 + 0.2 * Math.sin(time * 0.5);
    (meshRef.current.material as THREE.PointsMaterial).opacity = opacity;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.25} color={COLORS.GOLD_METALLIC} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation={true} />
    </points>
  );
};

// Inner Core - Green Gradient Particles that now Scatter
const InnerCore = ({ targetState, progress }: { targetState: TreeMorphState, progress: number }) => {
  const count = 2000;
  const meshRef = useRef<THREE.Points>(null);

  const { treePositions, scatterPositions, colors } = useMemo(() => {
    const tPos = new Float32Array(count * 3);
    const sPos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    
    const colorTop = new THREE.Color(COLORS.EMERALD_LIGHT);
    const colorBottom = new THREE.Color(COLORS.EMERALD_DEEP);

    for (let i = 0; i < count; i++) {
      // Tree Position: Cone Volume
      const h = Math.random(); 
      const y = (h * CONFIG.TREE_HEIGHT) - (CONFIG.TREE_HEIGHT / 2);
      const maxR = Math.pow((1 - h), 1.2) * (CONFIG.TREE_RADIUS * 0.8); // Slightly smaller than main tree
      const r = Math.random() * maxR;
      const theta = Math.random() * Math.PI * 2;
      
      tPos[i * 3] = r * Math.cos(theta);
      tPos[i * 3 + 1] = y;
      tPos[i * 3 + 2] = r * Math.sin(theta);

      // Scatter Position: Sphere Volume
      const sr = Math.cbrt(Math.random()) * CONFIG.SCATTER_RADIUS;
      const sTheta = Math.random() * Math.PI * 2;
      const sPhi = Math.acos(2 * Math.random() - 1);
      sPos[i * 3] = sr * Math.sin(sPhi) * Math.cos(sTheta);
      sPos[i * 3 + 1] = sr * Math.sin(sPhi) * Math.sin(sTheta);
      sPos[i * 3 + 2] = sr * Math.cos(sPhi);

      // Color Gradient
      const c = colorBottom.clone().lerp(colorTop, h);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { treePositions: tPos, scatterPositions: sPos, colors: col };
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const geometry = meshRef.current.geometry;
    const posAttr = geometry.attributes.position;
    
    // Ease function for morphing
    const t = progress; 
    const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    for (let i = 0; i < count; i++) {
      const tx = treePositions[i * 3];
      const ty = treePositions[i * 3 + 1];
      const tz = treePositions[i * 3 + 2];

      const sx = scatterPositions[i * 3];
      const sy = scatterPositions[i * 3 + 1];
      const sz = scatterPositions[i * 3 + 2];

      posAttr.setXYZ(
        i,
        THREE.MathUtils.lerp(sx, tx, easeT),
        THREE.MathUtils.lerp(sy, ty, easeT),
        THREE.MathUtils.lerp(sz, tz, easeT)
      );
    }
    posAttr.needsUpdate = true;
    // Fade out slightly when scattered to avoid clutter
    (meshRef.current.material as THREE.PointsMaterial).opacity = 0.3 + 0.3 * easeT;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={treePositions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial 
        size={0.15} 
        vertexColors 
        transparent 
        opacity={0.6} 
        blending={THREE.AdditiveBlending} 
        depthWrite={false}
      />
    </points>
  )
};

export const ArixTree: React.FC<ArixTreeProps> = ({ targetState, handData }) => {
  const rotatingGroupRef = useRef<THREE.Group>(null);
  const boxRef = useRef<THREE.InstancedMesh>(null);
  const sphereRef = useRef<THREE.InstancedMesh>(null);
  const dodecaRef = useRef<THREE.InstancedMesh>(null);
  const tetraRef = useRef<THREE.InstancedMesh>(null);
  const starRef = useRef<THREE.Group>(null);
  const parallaxGroupRef = useRef<THREE.Group>(null);
  
  const progress = useRef(0);
  const rotationSequenceStartRef = useRef<number | null>(null);
  
  // Physics Refs for Inertia
  const currentHandRotation = useRef(0);
  const currentHandPos = useRef({ x: 0, y: 0 });

  const layerRefs = {
    box: boxRef,
    sphere: sphereRef,
    dodecahedron: dodecaRef,
    tetrahedron: tetraRef
  };

  const particles = useMemo(() => {
    const allIndices = Array.from({ length: CONFIG.PARTICLE_COUNT }, (_, i) => i);
    for (let i = allIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
    }

    let globalIndexPointer = 0;

    return LAYERS.map((type) => {
      return new Array(COUNTS_PER_LAYER).fill(null).map((_, i) => {
        const treeIndex = allIndices[globalIndexPointer++];
        const rotEuler = generateRandomRotation();
        
        const treePos = getTreePoint(treeIndex, CONFIG.PARTICLE_COUNT, 0);
        
        let scale = 0.15 + Math.random() * 0.35;
        // Increase scale for bottom boxes (Gifts/Base) - NOW 2.5x (Reduced from 5.0x)
        if (type === 'box' && treePos.y < -CONFIG.TREE_HEIGHT * 0.35) {
          scale *= 2.5; 
        }

        return {
          id: i,
          scatterPos: getRandomSpherePoint(CONFIG.SCATTER_RADIUS),
          treePos: treePos,
          currentRot: new THREE.Vector3(rotEuler.x, rotEuler.y, rotEuler.z),
          scale: scale,
          color: getRandomPaletteColor(COLORS.PALETTE),
          rotationSpeed: (Math.random() + 0.2) * 1.0
        };
      });
    });
  }, []);

  const starData = useMemo(() => ({
    scatterPos: getRandomSpherePoint(CONFIG.SCATTER_RADIUS),
    treePos: new THREE.Vector3(0, CONFIG.TREE_HEIGHT / 2 + 1.5, 0),
  }), []);

  useLayoutEffect(() => {
    particles.forEach((layerData, index) => {
      const type = LAYERS[index];
      const ref = layerRefs[type].current;
      if (ref) {
        layerData.forEach((data, i) => {
          tempColor.set(data.color);
          ref.setColorAt(i, tempColor);
        });
        ref.instanceColor!.needsUpdate = true;
      }
    });
  }, [particles]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    // 1. Hand Control Physics (Inertia)
    if (handData?.isDetected) {
      // Smoothly interpolate rotation
      currentHandRotation.current = THREE.MathUtils.damp(currentHandRotation.current, handData.rotation, 3, delta);
      // Smoothly interpolate View Position (Parallax)
      currentHandPos.current.x = THREE.MathUtils.damp(currentHandPos.current.x, handData.x, 2, delta);
      currentHandPos.current.y = THREE.MathUtils.damp(currentHandPos.current.y, handData.y, 2, delta);
    } else {
      // Return to neutral if no hand
      currentHandRotation.current = THREE.MathUtils.damp(currentHandRotation.current, 0, 2, delta);
      currentHandPos.current.x = THREE.MathUtils.damp(currentHandPos.current.x, 0, 1, delta);
      currentHandPos.current.y = THREE.MathUtils.damp(currentHandPos.current.y, 0, 1, delta);
    }

    // Apply Parallax / Camera Shift to the Container Group
    if (parallaxGroupRef.current) {
      // Move the scene slightly opposite to hand to create "looking around" feel
      parallaxGroupRef.current.rotation.y = currentHandPos.current.x * 0.2; // Pan view horizontally
      parallaxGroupRef.current.rotation.x = currentHandPos.current.y * 0.1; // Tilt view vertically
    }

    // 2. Transition Progress
    const target = targetState === TreeMorphState.TREE_SHAPE ? 1 : 0;
    const step = delta * CONFIG.ANIMATION_SPEED;
    
    if (progress.current < target) {
      progress.current = Math.min(progress.current + step, target);
    } else if (progress.current > target) {
      progress.current = Math.max(progress.current - step, target);
    }

    const t = progress.current;
    const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // 3. Tree Rotation (Base Spin + Hand Spin)
    if (rotatingGroupRef.current) {
      let baseRot = easeT * Math.PI * 2;
      // Add inertial hand rotation
      rotatingGroupRef.current.rotation.y = baseRot + currentHandRotation.current;
    }

    // 4. Burst Animation Logic
    if (targetState === TreeMorphState.TREE_SHAPE) {
      rotationSequenceStartRef.current = null;
    }
    if (targetState === TreeMorphState.SCATTERED && progress.current < 0.25 && rotationSequenceStartRef.current === null) {
      rotationSequenceStartRef.current = time;
    }
    let speedMult = 1.0;
    if (rotationSequenceStartRef.current !== null) {
      const dt = time - rotationSequenceStartRef.current;
      const NORMAL_SPEED = 1.0;
      const BURST_SPEED = 20.0;
      if (dt < 1.0) {
        speedMult = THREE.MathUtils.lerp(NORMAL_SPEED, BURST_SPEED, THREE.MathUtils.smoothstep(dt, 0, 1.0));
      } else if (dt < 4.0) {
        speedMult = BURST_SPEED;
      } else {
        speedMult = THREE.MathUtils.lerp(BURST_SPEED, NORMAL_SPEED, THREE.MathUtils.smoothstep(dt, 4.0, 6.0));
      }
    }

    // 5. Update Particles
    particles.forEach((layerData, index) => {
      const type = LAYERS[index];
      const ref = layerRefs[type].current;
      if (!ref) return;

      layerData.forEach((data, i) => {
        tempVec3.lerpVectors(data.scatterPos, data.treePos, easeT);
        if (t < 0.95) {
          tempVec3.y += Math.sin(time + data.id * 0.1) * 0.1 * (1 - t);
          tempVec3.x += Math.cos(time * 0.5 + data.id) * 0.1 * (1 - t);
        }
        const currentSpeed = data.rotationSpeed * speedMult;
        data.currentRot.addScalar(currentSpeed * delta);

        dummy.rotation.set(data.currentRot.x, data.currentRot.y, data.currentRot.z);
        const pulse = 1 + Math.sin(time * 2 + data.id) * 0.1;
        dummy.scale.setScalar(data.scale * pulse);
        dummy.position.copy(tempVec3);
        dummy.updateMatrix();
        ref.setMatrixAt(i, dummy.matrix);
      });
      ref.instanceMatrix.needsUpdate = true;
    });

    if (starRef.current) {
      starRef.current.position.lerpVectors(starData.scatterPos, starData.treePos, easeT);
      starRef.current.rotation.y = time * 0.5;
      const starScale = 1.0 * (0.5 + 0.5 * easeT);
      starRef.current.scale.setScalar(starScale);
    }
  });

  const material = (
    <meshStandardMaterial roughness={0.05} metalness={1.0} emissiveIntensity={0.5} color="#ffffff" />
  );

  return (
    <group ref={parallaxGroupRef}>
      <AmbientParticles />
      <SnowParticles />
      
      <group ref={rotatingGroupRef}>
        <InnerCore targetState={targetState} progress={progress.current} />
        
        <instancedMesh ref={boxRef} args={[undefined, undefined, COUNTS_PER_LAYER]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          {material}
        </instancedMesh>

        <instancedMesh ref={sphereRef} args={[undefined, undefined, COUNTS_PER_LAYER]} castShadow receiveShadow>
          <sphereGeometry args={[0.6, 16, 16]} />
          {material}
        </instancedMesh>

        <instancedMesh ref={dodecaRef} args={[undefined, undefined, COUNTS_PER_LAYER]} castShadow receiveShadow>
          <dodecahedronGeometry args={[0.7, 0]} />
          {material}
        </instancedMesh>

        <instancedMesh ref={tetraRef} args={[undefined, undefined, COUNTS_PER_LAYER]} castShadow receiveShadow>
          <tetrahedronGeometry args={[0.8, 0]} />
          {material}
        </instancedMesh>

        <group ref={starRef}>
           <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
              <CustomStar innerRadius={1.5 * 0.382} outerRadius={1.5} depth={0.4} count={5} position={[0,0,0]}>
                <meshStandardMaterial color={COLORS.GOLD_METALLIC} emissive="#ffaa00" emissiveIntensity={6} roughness={0.1} metalness={1} />
              </CustomStar>
           </Float>
        </group>
      </group>
    </group>
  );
};