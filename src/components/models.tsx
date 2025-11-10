"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

type ModelProps = {
  position: [number, number, number];
  color: string;
};

const applyColor = (scene: THREE.Object3D, color: string) => {
  scene.traverse((child: any) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      child.material.color = new THREE.Color(color);
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
};

export const KingModel = ({ position, color }: ModelProps) => {
  const { scene } = useGLTF("/king.glb");
  const cloned = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    applyColor(cloned, color);
  }, [cloned, color]);

  return <primitive object={cloned} scale={0.7} position={position} rotation={[0, -Math.PI / 2, 0]} />;
};

export const QueenModel = ({ position, color }: ModelProps) => {
  const { scene } = useGLTF("/queen.glb");
  const cloned = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    applyColor(cloned, color);
  }, [cloned, color]);

  return <primitive object={cloned} scale={0.25} position={position} />;
};

export const BishopModel = ({ position, color }: ModelProps) => {
  const { scene } = useGLTF("/bishop.glb");
  const cloned = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    applyColor(cloned, color);
  }, [cloned, color]);

  return <primitive object={cloned} scale={0.25} position={position} />;
};

export const KnightModel = ({ position, color }: ModelProps) => {
  const { scene } = useGLTF("/knight.glb");
  const cloned = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    applyColor(cloned, color);
  }, [cloned, color]);

  return <primitive object={cloned} scale={0.15} position={position} rotation={[0, -Math.PI / 2, 0]} />;
};

export const RookModel = ({ position, color }: ModelProps) => {
  const { scene } = useGLTF("/rook.glb");
  const cloned = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    applyColor(cloned, color);
  }, [cloned, color]);

  return <primitive object={cloned} scale={0.15} position={position} />;
};

export const PawnModel = ({ position, color }: ModelProps) => {
  const { scene } = useGLTF("/pawn.glb");
  const cloned = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    applyColor(cloned, color);
  }, [cloned, color]);

  return <primitive object={cloned} scale={0.12} position={position} />;
};

useGLTF.preload("/king.glb");
useGLTF.preload("/queen.glb");
useGLTF.preload("/bishop.glb");
useGLTF.preload("/knight.glb");
useGLTF.preload("/rook.glb");
useGLTF.preload("/pawn.glb");
