import React, { useRef, useState } from 'react';
import { View, StyleSheet, Image, Dimensions, TouchableOpacity, Button, PanResponder, Text } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { Asset } from 'expo-asset';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import building from './assets/models/building.glb';
import layout1 from './assets/models/layout_1.png';
import layout2 from './assets/models/layout_2.jpeg';
import ImageZoom from 'react-native-image-pan-zoom';
import { MaterialIcons } from '@expo/vector-icons';
// or: import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function App() {
  const modelRef = useRef();
  const cameraRef = useRef();
  const sceneRef = useRef();
  const rendererRef = useRef();
  const [selectedLayout, setSelectedLayout] = useState(null);
  const selectedMesh = useRef(null);
  const originalMaterial = useRef(null);
  const rotateY = useRef(0);
  const rotateX = useRef(0);

  // Map mesh names to layout images
  const layoutImages = {
    o_glass: layout1,
    o_concrete_01: layout2,
    // Add more mappings as needed
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        if (!selectedLayout) {
          rotateY.current += gesture.dx * 0.0002;
        }
      },
      onPanResponderRelease: (evt, gesture) => {
        // If the finger didn't move much, treat as a tap
        if (Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5) {
          handleTouch(evt);
        }
      },
    })
  ).current;

  const onContextCreate = async (gl) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 3, 2);
    scene.add(directionalLight);

    // Load GLB model
    const asset = Asset.fromModule(building);
    await asset.downloadAsync();

    const loader = new GLTFLoader();
    loader.load(
      asset.uri,
      (gltf) => {
        const model = gltf.scene;
        modelRef.current = model;

        // Center and scale
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        camera.position.set(0, 0, size * 1.5);
        camera.lookAt(new THREE.Vector3(0, -0.5, 0));
        scene.add(model);
      },
      undefined,
      (error) => {
        console.error('Error loading model:', error);
      }
    );

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      if (modelRef.current) {
        modelRef.current.rotation.y = rotateY.current;
      }
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  };

  // Handle tap on GLView
  const handleTouch = (event) => {
    if (!modelRef.current || !cameraRef.current || !sceneRef.current || selectedLayout) return;

    const { locationX, locationY } = event.nativeEvent;

    // Convert to normalized device coordinates
    const x = (locationX / width) * 2 - 1;
    const y = -(locationY / height) * 2 + 1;

    const mouse = new THREE.Vector2(x, y);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Intersect with all meshes in the model
    const intersects = raycaster.intersectObjects(modelRef.current.children, true);

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      // Restore previous mesh's material if any
      if (selectedMesh.current && originalMaterial.current) {
        selectedMesh.current.material.color.copy(originalMaterial.current.color);
      }

      // Save the current mesh and its original material color
      selectedMesh.current = mesh;
      originalMaterial.current = { color: mesh.material.color.clone() };

      // Highlight the mesh (e.g., yellow)      
      mesh.material.color.set(0xffff00);

      if (layoutImages[mesh.name]) {
        setSelectedLayout(layoutImages[mesh.name]);
      }
    }
  };

  const closeLayout = () => {
    console.log('closeLayout');
    if (selectedMesh.current && originalMaterial.current) {
      selectedMesh.current.material.color.copy(originalMaterial.current.color);
    }
    setSelectedLayout(null);
    selectedMesh.current = null;
    originalMaterial.current = null;
  };

  const castLayout = () => {
    console.log('castLayout');
  };

  return (
    <View style={styles.container}>
      <View
        style={styles.glView}
        {...panResponder.panHandlers}
      >
        <GLView
          style={{ flex: 1 }}
          onContextCreate={onContextCreate}
        />
      </View>
      {selectedLayout && (
        <><View style={styles.buttonContainer}>
          <TouchableOpacity onPress={closeLayout} style={styles.closeButton}>
            <MaterialIcons name="close" size={28} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={castLayout} style={[styles.closeButton, { backgroundColor: 'blue' }]}>
            <MaterialIcons name="cast" size={28} color="white" />
          </TouchableOpacity>
        </View>
          <ImageZoom
            cropWidth={width}
            cropHeight={height / 2}
            imageWidth={width * 0.45}
            imageHeight={height * 0.9}
          >
            <Image
              style={styles.image}
              source={selectedLayout} />
          </ImageZoom></>

      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column'
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  glView: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
  },
  image: {
    flex: 1,
    resizeMode: 'contain',
    width: '90%',
    alignSelf: 'center',
  },
  closeButton: {
    height: 50,
    width: 50,
    backgroundColor: 'red',
    alignSelf: 'flex-end',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    marginBottom: 10,
    marginTop: 10,
    marginRight: 10,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  }
});