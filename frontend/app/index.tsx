import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Imágenes reales de productos Mercadona
const PRODUCT_IMAGES: {[key: string]: string} = {
  '6260': 'https://prod-mercadona.imgix.net/images/f846b6d8b9daffa2b61c4c115020d4dd.jpg?fit=crop&h=300&w=300',
  '6269': 'https://prod-mercadona.imgix.net/images/12cb042a1db2a965e3a7b1be7b01bd62.jpg?fit=crop&h=300&w=300',
  '6175': 'https://prod-mercadona.imgix.net/images/cba9ea825acfc6789572d4088ac61392.jpg?fit=crop&h=300&w=300',
  '6142': 'https://prod-mercadona.imgix.net/images/a479103aa629d24e19a1655e8459b8ee.jpg?fit=crop&h=300&w=300',
  '17151': 'https://prod-mercadona.imgix.net/images/bef3c040943e4b6dd59b15f565ec4f08.jpg?fit=crop&h=300&w=300',
  '16044': 'https://prod-mercadona.imgix.net/images/db53895dcbf286affe16def253a0ab89.jpg?fit=crop&h=300&w=300',
  '13568': 'https://prod-mercadona.imgix.net/images/01e62dd81eb0ed0c43d341f5dc84d170.jpg?fit=crop&h=300&w=300',
  '61251': 'https://prod-mercadona.imgix.net/images/1c5db356adc87b3adf62cdfb01512dfc.jpg?fit=crop&h=300&w=300',
  '51050': 'https://prod-mercadona.imgix.net/images/82991bcf404ead6164e1b3b4ad79eeea.jpg?fit=crop&h=300&w=300',
  '51203': 'https://prod-mercadona.imgix.net/images/18901ca537c8de2c4c77f69baf4ee430.jpg?fit=crop&h=300&w=300',
  '4740': 'https://prod-mercadona.imgix.net/images/a5648e373920a10023a7ab6304eb0dc0.jpg?fit=crop&h=300&w=300',
  '16252': 'https://prod-mercadona.imgix.net/images/9f4bbcd3b575f55df7aa9cea15ed0266.jpg?fit=crop&h=300&w=300',
  '10117': 'https://prod-mercadona.imgix.net/images/108f4b61a8ddeca7146ea3cf0622921d.jpg?fit=crop&h=300&w=300',
  '10161': 'https://prod-mercadona.imgix.net/images/f451d3695c8b94b17cb61540de841da8.jpg?fit=crop&h=300&w=300',
  '16618': 'https://prod-mercadona.imgix.net/images/4c97fc1fdefb7083f3ddfa0fd6169cb4.jpg?fit=crop&h=300&w=300',
  '2867': 'https://prod-mercadona.imgix.net/images/2781547566ca8d299f1e2e0d9cdccd4f.jpg?fit=crop&h=300&w=300',
  '2871': 'https://prod-mercadona.imgix.net/images/087eaf211a0fc38ef1ced35ff9b44a18.jpg?fit=crop&h=300&w=300',
  '2872': 'https://prod-mercadona.imgix.net/images/e5279086a2d46bed3787947f6a620949.jpg?fit=crop&h=300&w=300',
  '35221': 'https://prod-mercadona.imgix.net/images/edc3300ee19dd682083042d5b90d4ca1.jpg?fit=crop&h=300&w=300',
  '5044': 'https://prod-mercadona.imgix.net/images/0daf43fb5761b823ce83c985930c97c9.jpg?fit=crop&h=300&w=300',
  '5063': 'https://prod-mercadona.imgix.net/images/801f924df0d429d82c0a136901dcb9b0.jpg?fit=crop&h=300&w=300',
  '53141': 'https://prod-mercadona.imgix.net/images/d3ca58a7c971dab07cb0095a4391f33b.jpg?fit=crop&h=300&w=300',
  '14485': 'https://prod-mercadona.imgix.net/images/ca671a930747bd720275ab34ee0ecfc3.jpg?fit=crop&h=300&w=300',
  '61200': 'https://prod-mercadona.imgix.net/images/110a733a4288e3cee3fa98822491ea5a.jpg?fit=crop&h=300&w=300',
  '61279': 'https://prod-mercadona.imgix.net/images/708f8d553aec26d56e2e09daf447df4b.jpg?fit=crop&h=300&w=300',
  '61289': 'https://prod-mercadona.imgix.net/images/be6852af02a87787b9dad6356b8069aa.jpg?fit=crop&h=300&w=300',
  '26011': 'https://prod-mercadona.imgix.net/images/ffbc3f23e35051fc1a326bda5a4f9063.jpg?fit=crop&h=300&w=300',
  '26028': 'https://prod-mercadona.imgix.net/images/5f0806bcbd4a2de3c9f7dd39468359bb.jpg?fit=crop&h=300&w=300',
  '26039': 'https://prod-mercadona.imgix.net/images/66cff189ab481a314894b2ca6c1a5ff3.jpg?fit=crop&h=300&w=300',
  '69066': 'https://prod-mercadona.imgix.net/images/12ec1b808bbcbc2d5ad6b40d9021cf76.jpg?fit=crop&h=300&w=300',
  '16315': 'https://prod-mercadona.imgix.net/images/5da9e6258cbd2e45b4b84ad093cfc80b.jpg?fit=crop&h=300&w=300',
  '4940': 'https://prod-mercadona.imgix.net/images/44c1552cc9f3945d63d01565d313846c.jpg?fit=crop&h=300&w=300',
};

// Función para obtener imagen de producto
const getProductImageUrl = (productId: string, fallbackUrl?: string): string => {
  return PRODUCT_IMAGES[productId] || fallbackUrl || '';
};

// Types
interface Category {
  id: number;
  name: string;
  categories?: Category[];
}

interface Product {
  id: string;
  display_name?: string;
  name?: string;
  price_instructions?: {
    unit_price?: number;
    reference_price?: string;
    bulk_price?: number;
  };
  thumbnail?: string;
  photos?: Array<{ regular?: string; thumbnail?: string }>;
  packaging?: string;
}

interface ShoppingListItem {
  product_id: string;
  product_data: Product;
  quantity: number;
}

interface ShoppingList {
  id: string;
  items: ShoppingListItem[];
  budget: number;
}

interface FavoriteProduct {
  id: string;
  product_id: string;
  product_data: Product;
}

interface RecipeIngredient {
  product_id: string;
  name: string;
  quantity: string;
  product_data: Product;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  time: string;
  difficulty: string;
  image: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
}

// Recetas precargadas con productos ECONÓMICOS de Mercadona - VERSIÓN COMPLETA
const PRELOADED_RECIPES: Recipe[] = [
  // === PASTA (5 recetas) ===
  {
    id: 'macarrones-tomate',
    name: 'Macarrones con Tomate y Queso',
    description: 'Clásico plato de pasta con salsa de tomate casera gratinada con queso',
    servings: 4, time: '30 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/67d0e2f86e0f0a8e6c7ad8e5cf254a9d.jpg',
    ingredients: [
      { product_id: '6260', name: 'Macarrones', quantity: '500g', product_data: { id: '6260', display_name: 'Macarrón fino Hacendado', price_instructions: { unit_price: 0.80 }, thumbnail: 'https://prod-mercadona.imgix.net/images/67d0e2f86e0f0a8e6c7ad8e5cf254a9d.jpg' }},
      { product_id: '17151', name: 'Tomate frito', quantity: '400g', product_data: { id: '17151', display_name: 'Tomate frito Hacendado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '150g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '20g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '51050', name: 'Mozzarella', quantity: '125g', product_data: { id: '51050', display_name: 'Mozzarella fresca de vaca Hacendado', price_instructions: { unit_price: 0.90 }, thumbnail: 'https://prod-mercadona.imgix.net/images/mozzarella.jpg' }},
      { product_id: '4740', name: 'Aceite de oliva virgen', quantity: '2 cucharadas', product_data: { id: '4740', display_name: 'Aceite de oliva virgen extra Hacendado', price_instructions: { unit_price: 4.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/aceite.jpg' }},
    ],
    instructions: [
      'Hervir agua con sal abundante y cocer los macarrones al dente (10-12 min)',
      'Mientras, sofreír el ajo en aceite de oliva hasta que dore ligeramente',
      'Añadir la cebolla y cocinar 5 minutos hasta que esté transparente',
      'Incorporar el tomate frito, sal y pimienta, cocinar 10 minutos a fuego medio',
      'Escurrir la pasta y mezclar con la salsa de tomate',
      'Poner en fuente de horno, cubrir con mozzarella troceada y gratinar 5 min'
    ]
  },
  {
    id: 'espaguetis-carbonara',
    name: 'Espaguetis a la Carbonara',
    description: 'Auténtica pasta carbonara cremosa con bacon crujiente y huevo',
    servings: 4, time: '25 min', difficulty: 'Media',
    image: 'https://prod-mercadona.imgix.net/images/espagueti.jpg',
    ingredients: [
      { product_id: '6269', name: 'Espaguetis', quantity: '400g', product_data: { id: '6269', display_name: 'Pasta espagueti Hacendado', price_instructions: { unit_price: 0.80 }, thumbnail: 'https://prod-mercadona.imgix.net/images/espagueti.jpg' }},
      { product_id: '16252', name: 'Bacon en tiras', quantity: '200g', product_data: { id: '16252', display_name: 'Bacón Hacendado cintas', price_instructions: { unit_price: 2.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/bacon.jpg' }},
      { product_id: '10117', name: 'Nata para cocinar', quantity: '200ml', product_data: { id: '10117', display_name: 'Nata fresca para cocinar', price_instructions: { unit_price: 1.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/nata.jpg' }},
      { product_id: '51203', name: 'Queso para untar', quantity: '100g', product_data: { id: '51203', display_name: 'Queso untar suave de vaca Hacendado', price_instructions: { unit_price: 1.45 }, thumbnail: 'https://prod-mercadona.imgix.net/images/queso.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '10g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
    ],
    instructions: [
      'Cocer los espaguetis en agua con sal hasta que estén al dente',
      'Cortar el bacon en trozos pequeños y freír hasta que esté crujiente',
      'Añadir el ajo picado y sofreír 1 minuto sin que se queme',
      'Batir la nata con el queso y una pizca de pimienta negra',
      'Escurrir la pasta reservando un poco de agua de cocción',
      'Mezclar la pasta con el bacon, retirar del fuego y añadir la mezcla de nata',
      'Remover rápidamente para que quede cremoso, añadir agua de cocción si es necesario'
    ]
  },
  {
    id: 'gnocchi-nata-champis',
    name: 'Ñoquis con Nata y Champiñones',
    description: 'Cremosos ñoquis con salsa de nata, champiñones y un toque de ajo',
    servings: 4, time: '20 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/gnocchi.jpg',
    ingredients: [
      { product_id: '6175', name: 'Ñoquis', quantity: '500g', product_data: { id: '6175', display_name: 'Pasta fresca gnocchi Hacendado', price_instructions: { unit_price: 1.00 }, thumbnail: 'https://prod-mercadona.imgix.net/images/gnocchi.jpg' }},
      { product_id: '10117', name: 'Nata para cocinar', quantity: '200ml', product_data: { id: '10117', display_name: 'Nata fresca para cocinar', price_instructions: { unit_price: 1.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/nata.jpg' }},
      { product_id: '16618', name: 'Champiñones laminados', quantity: '1 lata (315g)', product_data: { id: '16618', display_name: 'Champiñones laminados Hacendado', price_instructions: { unit_price: 1.00 }, thumbnail: 'https://prod-mercadona.imgix.net/images/champi.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '100g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '15g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '51203', name: 'Queso untar', quantity: '50g', product_data: { id: '51203', display_name: 'Queso untar suave de vaca Hacendado', price_instructions: { unit_price: 1.45 }, thumbnail: 'https://prod-mercadona.imgix.net/images/queso.jpg' }},
    ],
    instructions: [
      'Cocer los ñoquis en agua hirviendo con sal (flotan cuando están listos, 2-3 min)',
      'En una sartén grande, sofreír la cebolla en aceite hasta que esté transparente',
      'Añadir el ajo y los champiñones escurridos, saltear 3-4 minutos',
      'Incorporar la nata y el queso de untar, remover hasta que se integre',
      'Sazonar con sal, pimienta y nuez moscada al gusto',
      'Añadir los ñoquis escurridos a la salsa y mezclar bien',
      'Servir caliente con un poco de perejil por encima'
    ]
  },
  {
    id: 'pasta-boloñesa',
    name: 'Pasta a la Boloñesa',
    description: 'Tradicional salsa boloñesa con carne picada y tomate, servida con pasta',
    servings: 4, time: '45 min', difficulty: 'Media',
    image: 'https://prod-mercadona.imgix.net/images/espagueti.jpg',
    ingredients: [
      { product_id: '6269', name: 'Espaguetis o tallarines', quantity: '400g', product_data: { id: '6269', display_name: 'Pasta espagueti Hacendado', price_instructions: { unit_price: 0.80 }, thumbnail: 'https://prod-mercadona.imgix.net/images/espagueti.jpg' }},
      { product_id: '2867', name: 'Carne picada de cerdo', quantity: '400g', product_data: { id: '2867', display_name: 'Preparado de carne picada cerdo', price_instructions: { unit_price: 2.75 }, thumbnail: 'https://prod-mercadona.imgix.net/images/carne.jpg' }},
      { product_id: '17151', name: 'Tomate frito', quantity: '400g', product_data: { id: '17151', display_name: 'Tomate frito Hacendado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '150g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '20g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '35221', name: 'Pimiento', quantity: '100g', product_data: { id: '35221', display_name: 'Pimiento rojo y verde ultracongelado', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/pimiento.jpg' }},
    ],
    instructions: [
      'Sofreír la cebolla y el pimiento en aceite durante 5 minutos',
      'Añadir el ajo y la carne picada, cocinar hasta que la carne esté dorada',
      'Incorporar el tomate frito, sal, pimienta y una pizca de orégano',
      'Cocinar a fuego lento durante 20-25 minutos removiendo ocasionalmente',
      'Mientras, cocer la pasta en agua con sal abundante',
      'Escurrir la pasta y servir con la salsa boloñesa por encima'
    ]
  },
  {
    id: 'lasaña-carne',
    name: 'Lasaña de Carne',
    description: 'Capas de pasta con ragú de carne y bechamel gratinada',
    servings: 6, time: '60 min', difficulty: 'Media',
    image: 'https://prod-mercadona.imgix.net/images/lasana.jpg',
    ingredients: [
      { product_id: '6142', name: 'Placas de lasaña', quantity: '250g', product_data: { id: '6142', display_name: 'Pasta lasaña Hacendado', price_instructions: { unit_price: 1.10 }, thumbnail: 'https://prod-mercadona.imgix.net/images/lasana.jpg' }},
      { product_id: '2867', name: 'Carne picada', quantity: '500g', product_data: { id: '2867', display_name: 'Preparado de carne picada cerdo', price_instructions: { unit_price: 2.75 }, thumbnail: 'https://prod-mercadona.imgix.net/images/carne.jpg' }},
      { product_id: '17151', name: 'Tomate frito', quantity: '400g', product_data: { id: '17151', display_name: 'Tomate frito Hacendado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '150g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '10117', name: 'Nata para cocinar', quantity: '200ml', product_data: { id: '10117', display_name: 'Nata fresca para cocinar', price_instructions: { unit_price: 1.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/nata.jpg' }},
      { product_id: '51050', name: 'Mozzarella', quantity: '200g', product_data: { id: '51050', display_name: 'Mozzarella fresca de vaca Hacendado', price_instructions: { unit_price: 0.90 }, thumbnail: 'https://prod-mercadona.imgix.net/images/mozzarella.jpg' }},
    ],
    instructions: [
      'Preparar el ragú: sofreír cebolla, añadir carne y dorar, luego tomate. Cocinar 20 min',
      'Preparar bechamel casera o mezclar nata con queso de untar y calentar',
      'En una fuente de horno, poner capa de ragú, placas de lasaña, bechamel',
      'Repetir las capas terminando con bechamel y mozzarella rallada',
      'Hornear a 180°C durante 30-35 minutos hasta que esté dorada',
      'Dejar reposar 5 minutos antes de servir'
    ]
  },

  // === ARROZ (4 recetas) ===
  {
    id: 'arroz-cubana',
    name: 'Arroz a la Cubana Completo',
    description: 'Arroz blanco con huevo frito, plátano frito, tomate y salchichas',
    servings: 4, time: '30 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/arroz.jpg',
    ingredients: [
      { product_id: '5063', name: 'Arroz largo', quantity: '320g', product_data: { id: '5063', display_name: 'Arroz largo Hacendado', price_instructions: { unit_price: 1.25 }, thumbnail: 'https://prod-mercadona.imgix.net/images/arroz.jpg' }},
      { product_id: '17151', name: 'Tomate frito', quantity: '300g', product_data: { id: '17151', display_name: 'Tomate frito Hacendado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
      { product_id: '53141', name: 'Salchichas Frankfurt', quantity: '4 unidades', product_data: { id: '53141', display_name: 'Salchichas Frankfurt Hacendado', price_instructions: { unit_price: 1.90 }, thumbnail: 'https://prod-mercadona.imgix.net/images/frankfurt.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '10g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '4740', name: 'Aceite de oliva', quantity: '3 cucharadas', product_data: { id: '4740', display_name: 'Aceite de oliva virgen extra Hacendado', price_instructions: { unit_price: 4.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/aceite.jpg' }},
    ],
    instructions: [
      'Lavar el arroz y cocerlo en agua con sal (proporción 1:2) durante 15-18 minutos',
      'Calentar el tomate frito en una sartén con un poco de ajo dorado',
      'Freír las salchichas hasta que estén doradas por todos lados',
      'Freír los huevos en abundante aceite caliente (uno por persona)',
      'Servir el arroz en el centro, tomate a un lado, huevo encima y salchichas'
    ]
  },
  {
    id: 'arroz-verduras',
    name: 'Arroz Salteado con Verduras',
    description: 'Arroz estilo oriental con verduras variadas y salsa de soja',
    servings: 4, time: '30 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/arroz.jpg',
    ingredients: [
      { product_id: '5044', name: 'Arroz redondo', quantity: '300g', product_data: { id: '5044', display_name: 'Arroz redondo Hacendado', price_instructions: { unit_price: 1.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/arroz.jpg' }},
      { product_id: '35221', name: 'Pimientos', quantity: '200g', product_data: { id: '35221', display_name: 'Pimiento rojo y verde ultracongelado', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/pimiento.jpg' }},
      { product_id: '61200', name: 'Guisantes', quantity: '150g', product_data: { id: '61200', display_name: 'Guisante muy tierno ultracongelado', price_instructions: { unit_price: 1.05 }, thumbnail: 'https://prod-mercadona.imgix.net/images/guisante.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '100g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '15g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '61289', name: 'Maíz dulce', quantity: '100g', product_data: { id: '61289', display_name: 'Maíz dulce ultracongelado', price_instructions: { unit_price: 1.24 }, thumbnail: 'https://prod-mercadona.imgix.net/images/maiz.jpg' }},
    ],
    instructions: [
      'Cocer el arroz y dejarlo enfriar (mejor si es del día anterior)',
      'Saltear las verduras en un wok o sartén grande con aceite muy caliente',
      'Empezar por la cebolla y el ajo, luego pimientos, guisantes y maíz',
      'Añadir el arroz frío y saltear a fuego alto removiendo constantemente',
      'Sazonar con sal y un chorrito de salsa de soja',
      'Servir caliente decorado con cebollino si se desea'
    ]
  },
  {
    id: 'arroz-pollo',
    name: 'Arroz con Pollo',
    description: 'Clásico arroz con pollo, verduras y un toque de azafrán',
    servings: 4, time: '45 min', difficulty: 'Media',
    image: 'https://prod-mercadona.imgix.net/images/arroz.jpg',
    ingredients: [
      { product_id: '5044', name: 'Arroz redondo', quantity: '320g', product_data: { id: '5044', display_name: 'Arroz redondo Hacendado', price_instructions: { unit_price: 1.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/arroz.jpg' }},
      { product_id: '14485', name: 'Churrasco de pollo', quantity: '400g', product_data: { id: '14485', display_name: 'Churrasco de pollo', price_instructions: { unit_price: 2.80 }, thumbnail: 'https://prod-mercadona.imgix.net/images/pollo.jpg' }},
      { product_id: '35221', name: 'Pimientos', quantity: '150g', product_data: { id: '35221', display_name: 'Pimiento rojo y verde ultracongelado', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/pimiento.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '100g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '20g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '16044', name: 'Tomate triturado', quantity: '200g', product_data: { id: '16044', display_name: 'Tomate triturado Hacendado', price_instructions: { unit_price: 0.60 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
    ],
    instructions: [
      'Cortar el pollo en trozos y dorar en una paella o sartén amplia',
      'Retirar el pollo y en el mismo aceite sofreír cebolla, ajo y pimientos',
      'Añadir el tomate y cocinar 5 minutos',
      'Incorporar el arroz y nacar durante 2 minutos',
      'Añadir el caldo caliente (doble de agua que de arroz) y el pollo',
      'Cocinar 18-20 minutos sin remover, dejar reposar 5 minutos antes de servir'
    ]
  },
  {
    id: 'risotto-champinones',
    name: 'Risotto de Champiñones',
    description: 'Cremoso risotto italiano con champiñones y queso',
    servings: 4, time: '35 min', difficulty: 'Media',
    image: 'https://prod-mercadona.imgix.net/images/arroz.jpg',
    ingredients: [
      { product_id: '5044', name: 'Arroz redondo', quantity: '320g', product_data: { id: '5044', display_name: 'Arroz redondo Hacendado', price_instructions: { unit_price: 1.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/arroz.jpg' }},
      { product_id: '16618', name: 'Champiñones', quantity: '2 latas', product_data: { id: '16618', display_name: 'Champiñones laminados Hacendado', price_instructions: { unit_price: 1.00 }, thumbnail: 'https://prod-mercadona.imgix.net/images/champi.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '100g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '10117', name: 'Nata para cocinar', quantity: '100ml', product_data: { id: '10117', display_name: 'Nata fresca para cocinar', price_instructions: { unit_price: 1.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/nata.jpg' }},
      { product_id: '51203', name: 'Queso untar', quantity: '100g', product_data: { id: '51203', display_name: 'Queso untar suave de vaca Hacendado', price_instructions: { unit_price: 1.45 }, thumbnail: 'https://prod-mercadona.imgix.net/images/queso.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '10g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
    ],
    instructions: [
      'Saltear los champiñones con ajo en mantequilla, reservar',
      'En la misma olla, pochar la cebolla hasta que esté transparente',
      'Añadir el arroz y nacar 2 minutos removiendo',
      'Ir añadiendo caldo caliente cucharón a cucharón, removiendo constantemente',
      'Cuando el arroz esté al dente (18-20 min), añadir nata, queso y champiñones',
      'Rectificar de sal y pimienta, servir inmediatamente'
    ]
  },

  // === LEGUMBRES (4 recetas) ===
  {
    id: 'lentejas-completas',
    name: 'Lentejas Estofadas Completas',
    description: 'Tradicionales lentejas españolas con verduras y chorizo',
    servings: 4, time: '35 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/lenteja.jpg',
    ingredients: [
      { product_id: '26011', name: 'Lentejas cocidas', quantity: '2 botes (800g)', product_data: { id: '26011', display_name: 'Lenteja cocida Hacendado', price_instructions: { unit_price: 0.75 }, thumbnail: 'https://prod-mercadona.imgix.net/images/lenteja.jpg' }},
      { product_id: '53141', name: 'Salchichas', quantity: '4 unidades', product_data: { id: '53141', display_name: 'Salchichas Frankfurt Hacendado', price_instructions: { unit_price: 1.90 }, thumbnail: 'https://prod-mercadona.imgix.net/images/frankfurt.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '150g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '35221', name: 'Pimiento', quantity: '100g', product_data: { id: '35221', display_name: 'Pimiento rojo y verde ultracongelado', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/pimiento.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '20g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '16044', name: 'Tomate triturado', quantity: '200g', product_data: { id: '16044', display_name: 'Tomate triturado Hacendado', price_instructions: { unit_price: 0.60 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
    ],
    instructions: [
      'Sofreír la cebolla y el pimiento en aceite hasta que estén tiernos',
      'Añadir el ajo y cocinar 1 minuto más',
      'Incorporar las salchichas troceadas y dorar ligeramente',
      'Añadir el tomate y cocinar 5 minutos',
      'Incorporar las lentejas escurridas con un poco de su líquido',
      'Sazonar con sal, pimienta y pimentón, cocinar 15 minutos a fuego lento'
    ]
  },
  {
    id: 'garbanzos-espinacas',
    name: 'Garbanzos con Espinacas',
    description: 'Plato saludable de garbanzos con espinacas y un toque de comino',
    servings: 4, time: '25 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/garbanzo.jpg',
    ingredients: [
      { product_id: '26039', name: 'Garbanzos cocidos', quantity: '2 botes (800g)', product_data: { id: '26039', display_name: 'Garbanzo cocido Hacendado', price_instructions: { unit_price: 0.75 }, thumbnail: 'https://prod-mercadona.imgix.net/images/garbanzo.jpg' }},
      { product_id: '61279', name: 'Espinacas', quantity: '400g', product_data: { id: '61279', display_name: 'Espinaca en porciones ultracongelada', price_instructions: { unit_price: 1.00 }, thumbnail: 'https://prod-mercadona.imgix.net/images/espinaca.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '30g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '100g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '16044', name: 'Tomate triturado', quantity: '150g', product_data: { id: '16044', display_name: 'Tomate triturado Hacendado', price_instructions: { unit_price: 0.60 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
      { product_id: '4740', name: 'Aceite de oliva virgen', quantity: '3 cucharadas', product_data: { id: '4740', display_name: 'Aceite de oliva virgen extra Hacendado', price_instructions: { unit_price: 4.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/aceite.jpg' }},
    ],
    instructions: [
      'Dorar el ajo en abundante aceite de oliva sin que se queme',
      'Añadir la cebolla y pochar hasta que esté transparente',
      'Incorporar las espinacas (si son congeladas, dejar que suelten el agua)',
      'Añadir el tomate y cocinar 5 minutos',
      'Incorporar los garbanzos escurridos, sazonar con sal, pimienta, comino y pimentón',
      'Cocinar todo junto 10 minutos, ajustar el punto de sal'
    ]
  },
  {
    id: 'alubias-tomate',
    name: 'Alubias con Tomate y Bacon',
    description: 'Alubias blancas guisadas con tomate y bacon crujiente',
    servings: 4, time: '30 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/alubia.jpg',
    ingredients: [
      { product_id: '26028', name: 'Alubias cocidas', quantity: '2 botes (800g)', product_data: { id: '26028', display_name: 'Alubia cocida blanca Hacendado', price_instructions: { unit_price: 0.70 }, thumbnail: 'https://prod-mercadona.imgix.net/images/alubia.jpg' }},
      { product_id: '16252', name: 'Bacon', quantity: '150g', product_data: { id: '16252', display_name: 'Bacón Hacendado cintas', price_instructions: { unit_price: 2.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/bacon.jpg' }},
      { product_id: '17151', name: 'Tomate frito', quantity: '400g', product_data: { id: '17151', display_name: 'Tomate frito Hacendado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '150g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '15g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
    ],
    instructions: [
      'Cortar el bacon en trozos y freír hasta que esté crujiente, reservar',
      'En la misma grasa, sofreír la cebolla y el ajo',
      'Añadir el tomate frito y cocinar 5 minutos',
      'Incorporar las alubias escurridas',
      'Sazonar con sal, pimienta y una hoja de laurel',
      'Cocinar 15 minutos, servir con el bacon crujiente por encima'
    ]
  },
  {
    id: 'potaje-garbanzos',
    name: 'Potaje de Garbanzos',
    description: 'Reconfortante potaje con garbanzos, espinacas y huevo cocido',
    servings: 4, time: '30 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/garbanzo.jpg',
    ingredients: [
      { product_id: '26039', name: 'Garbanzos cocidos', quantity: '2 botes', product_data: { id: '26039', display_name: 'Garbanzo cocido Hacendado', price_instructions: { unit_price: 0.75 }, thumbnail: 'https://prod-mercadona.imgix.net/images/garbanzo.jpg' }},
      { product_id: '61279', name: 'Espinacas', quantity: '300g', product_data: { id: '61279', display_name: 'Espinaca en porciones ultracongelada', price_instructions: { unit_price: 1.00 }, thumbnail: 'https://prod-mercadona.imgix.net/images/espinaca.jpg' }},
      { product_id: '69066', name: 'Patatas', quantity: '200g', product_data: { id: '69066', display_name: 'Patata', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/patata.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '100g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '20g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '16044', name: 'Tomate', quantity: '100g', product_data: { id: '16044', display_name: 'Tomate triturado Hacendado', price_instructions: { unit_price: 0.60 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
    ],
    instructions: [
      'Sofreír cebolla y ajo en aceite, añadir una cucharadita de pimentón',
      'Incorporar las patatas peladas y troceadas, cubrir con agua',
      'Cocinar 10 minutos, añadir los garbanzos y el tomate',
      'Añadir las espinacas y cocinar otros 10 minutos',
      'Sazonar con sal, comino y pimienta',
      'Servir con huevo cocido picado por encima (opcional)'
    ]
  },

  // === HUEVOS (4 recetas) ===
  {
    id: 'tortilla-patatas',
    name: 'Tortilla de Patatas',
    description: 'La auténtica tortilla española con patatas y cebolla',
    servings: 4, time: '40 min', difficulty: 'Media',
    image: 'https://prod-mercadona.imgix.net/images/tortilla.jpg',
    ingredients: [
      { product_id: '69066', name: 'Patatas', quantity: '600g', product_data: { id: '69066', display_name: 'Patata', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/patata.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '200g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '4740', name: 'Aceite de oliva', quantity: '200ml para freír', product_data: { id: '4740', display_name: 'Aceite de oliva virgen extra Hacendado', price_instructions: { unit_price: 4.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/aceite.jpg' }},
    ],
    instructions: [
      'Pelar y cortar las patatas en rodajas finas (3mm aprox)',
      'Freír las patatas y la cebolla en abundante aceite a fuego medio',
      'Cuando estén tiernas (no crujientes), escurrir bien reservando el aceite',
      'Batir 5-6 huevos con sal y mezclar con las patatas',
      'En una sartén con poco aceite, verter la mezcla y cuajar a fuego medio',
      'Dar la vuelta con ayuda de un plato y cuajar por el otro lado',
      'La tortilla debe quedar jugosa por dentro'
    ]
  },
  {
    id: 'huevos-rotos',
    name: 'Huevos Rotos con Jamón',
    description: 'Huevos fritos sobre cama de patatas crujientes con jamón',
    servings: 2, time: '30 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/huevos.jpg',
    ingredients: [
      { product_id: '69066', name: 'Patatas', quantity: '500g', product_data: { id: '69066', display_name: 'Patata', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/patata.jpg' }},
      { product_id: '16252', name: 'Bacon/Jamón', quantity: '100g', product_data: { id: '16252', display_name: 'Bacón Hacendado cintas', price_instructions: { unit_price: 2.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/bacon.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '15g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '4740', name: 'Aceite de oliva', quantity: 'para freír', product_data: { id: '4740', display_name: 'Aceite de oliva virgen extra Hacendado', price_instructions: { unit_price: 4.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/aceite.jpg' }},
    ],
    instructions: [
      'Pelar y cortar las patatas en bastones o rodajas',
      'Freír las patatas en abundante aceite hasta que estén doradas y crujientes',
      'En otra sartén, freír el bacon hasta que esté crujiente',
      'Freír los huevos en aceite muy caliente para que queden con la yema líquida',
      'Colocar las patatas en el plato, el bacon encima',
      'Poner los huevos fritos y romper las yemas sobre las patatas'
    ]
  },
  {
    id: 'revuelto-variado',
    name: 'Revuelto de Champiñones y Gambas',
    description: 'Cremoso revuelto con champiñones, gambas y un toque de ajo',
    servings: 2, time: '15 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/revuelto.jpg',
    ingredients: [
      { product_id: '16618', name: 'Champiñones', quantity: '1 lata', product_data: { id: '16618', display_name: 'Champiñones laminados Hacendado', price_instructions: { unit_price: 1.00 }, thumbnail: 'https://prod-mercadona.imgix.net/images/champi.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '20g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '4740', name: 'Aceite de oliva', quantity: '3 cucharadas', product_data: { id: '4740', display_name: 'Aceite de oliva virgen extra Hacendado', price_instructions: { unit_price: 4.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/aceite.jpg' }},
    ],
    instructions: [
      'Escurrir bien los champiñones y saltearlos con el ajo en aceite',
      'Cuando estén dorados, bajar el fuego',
      'Batir 4 huevos con sal y pimienta, verter sobre los champiñones',
      'Remover constantemente con una espátula de madera',
      'Retirar del fuego cuando aún esté cremoso (seguirá cuajando con el calor residual)',
      'Servir inmediatamente con pan tostado'
    ]
  },
  {
    id: 'huevos-rancheros',
    name: 'Huevos Rancheros',
    description: 'Huevos sobre tortilla con salsa de tomate picante',
    servings: 2, time: '20 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/huevos.jpg',
    ingredients: [
      { product_id: '17151', name: 'Tomate frito', quantity: '300g', product_data: { id: '17151', display_name: 'Tomate frito Hacendado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '100g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '35221', name: 'Pimientos', quantity: '100g', product_data: { id: '35221', display_name: 'Pimiento rojo y verde ultracongelado', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/pimiento.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '10g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '26039', name: 'Garbanzos (opcional)', quantity: '1 bote', product_data: { id: '26039', display_name: 'Garbanzo cocido Hacendado', price_instructions: { unit_price: 0.75 }, thumbnail: 'https://prod-mercadona.imgix.net/images/garbanzo.jpg' }},
    ],
    instructions: [
      'Sofreír cebolla, pimiento y ajo hasta que estén tiernos',
      'Añadir el tomate frito y cocinar 5 minutos',
      'Hacer huecos en la salsa y cascar los huevos directamente',
      'Tapar y cocinar a fuego medio hasta que las claras estén cuajadas',
      'Las yemas deben quedar líquidas',
      'Servir directamente de la sartén con pan para mojar'
    ]
  },

  // === VERDURAS (5 recetas) ===
  {
    id: 'judias-patatas',
    name: 'Judías Verdes con Patatas',
    description: 'Plato tradicional de judías verdes rehogadas con patatas y ajo',
    servings: 4, time: '35 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/judias.jpg',
    ingredients: [
      { product_id: '16315', name: 'Judías verdes', quantity: '2 latas (600g)', product_data: { id: '16315', display_name: 'Judías verdes redondas Hacendado', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/judias.jpg' }},
      { product_id: '69066', name: 'Patatas', quantity: '400g', product_data: { id: '69066', display_name: 'Patata', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/patata.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '30g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '16252', name: 'Bacon', quantity: '100g', product_data: { id: '16252', display_name: 'Bacón Hacendado cintas', price_instructions: { unit_price: 2.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/bacon.jpg' }},
      { product_id: '4940', name: 'Vinagre', quantity: '1 cucharada', product_data: { id: '4940', display_name: 'Vinagre de vino blanco Hacendado', price_instructions: { unit_price: 0.65 }, thumbnail: 'https://prod-mercadona.imgix.net/images/vinagre.jpg' }},
    ],
    instructions: [
      'Pelar y cortar las patatas en dados, cocerlas en agua con sal',
      'Cuando falten 5 minutos, añadir las judías escurridas para que se calienten',
      'En una sartén, dorar el ajo laminado y el bacon en aceite',
      'Escurrir las patatas y judías, añadirlas a la sartén',
      'Saltear todo junto, añadir un chorrito de vinagre',
      'Sazonar con sal, pimienta y pimentón'
    ]
  },
  {
    id: 'pisto-manchego',
    name: 'Pisto Manchego',
    description: 'Verduras salteadas estilo tradicional manchego',
    servings: 4, time: '40 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/pisto.jpg',
    ingredients: [
      { product_id: '35221', name: 'Pimientos', quantity: '300g', product_data: { id: '35221', display_name: 'Pimiento rojo y verde ultracongelado', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/pimiento.jpg' }},
      { product_id: '17151', name: 'Tomate frito', quantity: '400g', product_data: { id: '17151', display_name: 'Tomate frito Hacendado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '200g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '20g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '4740', name: 'Aceite de oliva', quantity: '4 cucharadas', product_data: { id: '4740', display_name: 'Aceite de oliva virgen extra Hacendado', price_instructions: { unit_price: 4.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/aceite.jpg' }},
    ],
    instructions: [
      'Cortar todas las verduras en dados pequeños si no están ya troceadas',
      'Sofreír la cebolla en aceite de oliva a fuego medio durante 10 minutos',
      'Añadir el ajo y los pimientos, cocinar otros 10 minutos',
      'Incorporar el tomate frito, sal, pimienta y una pizca de azúcar',
      'Cocinar a fuego lento 15-20 minutos hasta que las verduras estén tiernas',
      'Servir caliente o frío, ideal con huevo frito encima'
    ]
  },
  {
    id: 'guisantes-jamon',
    name: 'Guisantes con Jamón',
    description: 'Clásico acompañamiento español de guisantes salteados con jamón',
    servings: 4, time: '20 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/guisante.jpg',
    ingredients: [
      { product_id: '61200', name: 'Guisantes', quantity: '500g', product_data: { id: '61200', display_name: 'Guisante muy tierno ultracongelado', price_instructions: { unit_price: 1.05 }, thumbnail: 'https://prod-mercadona.imgix.net/images/guisante.jpg' }},
      { product_id: '16252', name: 'Bacon/Jamón', quantity: '150g', product_data: { id: '16252', display_name: 'Bacón Hacendado cintas', price_instructions: { unit_price: 2.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/bacon.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '100g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '10g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
    ],
    instructions: [
      'Sofreír la cebolla picada en aceite hasta que esté transparente',
      'Añadir el bacon/jamón cortado en trozos y dorar ligeramente',
      'Incorporar el ajo y cocinar 1 minuto',
      'Añadir los guisantes congelados y un vaso de agua',
      'Cocinar 10-12 minutos hasta que los guisantes estén tiernos',
      'Sazonar con sal y pimienta, servir caliente'
    ]
  },
  {
    id: 'crema-verduras',
    name: 'Crema de Verduras',
    description: 'Suave crema de verduras casera, ideal para cenar',
    servings: 4, time: '30 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/crema.jpg',
    ingredients: [
      { product_id: '69066', name: 'Patatas', quantity: '300g', product_data: { id: '69066', display_name: 'Patata', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/patata.jpg' }},
      { product_id: '35221', name: 'Pimientos', quantity: '150g', product_data: { id: '35221', display_name: 'Pimiento rojo y verde ultracongelado', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/pimiento.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '150g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '61200', name: 'Guisantes', quantity: '100g', product_data: { id: '61200', display_name: 'Guisante muy tierno ultracongelado', price_instructions: { unit_price: 1.05 }, thumbnail: 'https://prod-mercadona.imgix.net/images/guisante.jpg' }},
      { product_id: '51203', name: 'Queso untar', quantity: '50g', product_data: { id: '51203', display_name: 'Queso untar suave de vaca Hacendado', price_instructions: { unit_price: 1.45 }, thumbnail: 'https://prod-mercadona.imgix.net/images/queso.jpg' }},
    ],
    instructions: [
      'Pelar y trocear las patatas, poner a cocer en agua con sal',
      'Añadir el resto de verduras y cocer todo junto 20 minutos',
      'Escurrir reservando parte del caldo de cocción',
      'Triturar las verduras con batidora, añadiendo caldo hasta lograr la textura deseada',
      'Incorporar el queso de untar y mezclar bien',
      'Rectificar de sal y servir caliente con un chorrito de aceite de oliva'
    ]
  },
  {
    id: 'patatas-bravas',
    name: 'Patatas Bravas',
    description: 'Clásica tapa española con salsa brava casera',
    servings: 4, time: '35 min', difficulty: 'Media',
    image: 'https://prod-mercadona.imgix.net/images/bravas.jpg',
    ingredients: [
      { product_id: '69066', name: 'Patatas', quantity: '700g', product_data: { id: '69066', display_name: 'Patata', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/patata.jpg' }},
      { product_id: '17151', name: 'Tomate frito', quantity: '200g', product_data: { id: '17151', display_name: 'Tomate frito Hacendado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '15g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '4740', name: 'Aceite de oliva', quantity: 'para freír', product_data: { id: '4740', display_name: 'Aceite de oliva virgen extra Hacendado', price_instructions: { unit_price: 4.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/aceite.jpg' }},
    ],
    instructions: [
      'Pelar y cortar las patatas en dados grandes (3cm)',
      'Freír en abundante aceite caliente hasta que estén doradas y crujientes',
      'Para la salsa brava: sofreír ajo, añadir tomate y pimentón picante',
      'Cocinar la salsa 5 minutos, puede triturarse si se desea más fina',
      'Escurrir las patatas y salar',
      'Servir las patatas calientes con la salsa brava por encima'
    ]
  },

  // === PLATOS COMPLETOS (6 recetas) ===
  {
    id: 'pollo-tomate',
    name: 'Pollo en Salsa de Tomate',
    description: 'Jugoso pollo guisado en salsa de tomate con verduras',
    servings: 4, time: '40 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/pollo.jpg',
    ingredients: [
      { product_id: '14485', name: 'Pollo', quantity: '600g', product_data: { id: '14485', display_name: 'Churrasco de pollo', price_instructions: { unit_price: 2.80 }, thumbnail: 'https://prod-mercadona.imgix.net/images/pollo.jpg' }},
      { product_id: '17151', name: 'Tomate frito', quantity: '400g', product_data: { id: '17151', display_name: 'Tomate frito Hacendado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '150g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '35221', name: 'Pimientos', quantity: '150g', product_data: { id: '35221', display_name: 'Pimiento rojo y verde ultracongelado', price_instructions: { unit_price: 1.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/pimiento.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '20g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
    ],
    instructions: [
      'Salpimentar el pollo y dorarlo en una cazuela con aceite',
      'Retirar el pollo y en el mismo aceite sofreír cebolla, ajo y pimientos',
      'Añadir el tomate y cocinar 5 minutos',
      'Incorporar el pollo de nuevo, cubrir parcialmente con agua o caldo',
      'Cocinar a fuego medio 25-30 minutos hasta que el pollo esté tierno',
      'Rectificar de sal y servir con arroz o patatas'
    ]
  },
  {
    id: 'albondigas-tomate',
    name: 'Albóndigas en Salsa',
    description: 'Jugosas albóndigas caseras en salsa de tomate',
    servings: 4, time: '45 min', difficulty: 'Media',
    image: 'https://prod-mercadona.imgix.net/images/albondigas.jpg',
    ingredients: [
      { product_id: '2871', name: 'Albóndigas', quantity: '500g', product_data: { id: '2871', display_name: 'Albóndigas de cerdo', price_instructions: { unit_price: 4.55 }, thumbnail: 'https://prod-mercadona.imgix.net/images/albondigas.jpg' }},
      { product_id: '17151', name: 'Tomate frito', quantity: '400g', product_data: { id: '17151', display_name: 'Tomate frito Hacendado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '150g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '61251', name: 'Ajo', quantity: '20g', product_data: { id: '61251', display_name: 'Ajo troceado ultracongelado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/ajo.jpg' }},
      { product_id: '4740', name: 'Aceite de oliva', quantity: 'para freír', product_data: { id: '4740', display_name: 'Aceite de oliva virgen extra Hacendado', price_instructions: { unit_price: 4.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/aceite.jpg' }},
    ],
    instructions: [
      'Dorar las albóndigas en aceite caliente por todos lados, reservar',
      'En el mismo aceite, sofreír la cebolla y el ajo picados',
      'Añadir el tomate frito, sal, pimienta y una pizca de azúcar',
      'Cocinar la salsa 10 minutos a fuego medio',
      'Incorporar las albóndigas y cocinar 15-20 minutos a fuego lento',
      'Servir con patatas fritas o arroz blanco'
    ]
  },
  {
    id: 'hamburguesa-completa',
    name: 'Hamburguesa Completa Casera',
    description: 'Hamburguesa con todos los ingredientes y salsa especial',
    servings: 4, time: '25 min', difficulty: 'Fácil',
    image: 'https://prod-mercadona.imgix.net/images/burger.jpg',
    ingredients: [
      { product_id: '2872', name: 'Burger de carne', quantity: '4 unidades', product_data: { id: '2872', display_name: 'Burger de vacuno y cerdo', price_instructions: { unit_price: 4.20 }, thumbnail: 'https://prod-mercadona.imgix.net/images/burger.jpg' }},
      { product_id: '51050', name: 'Mozzarella/Queso', quantity: '4 lonchas', product_data: { id: '51050', display_name: 'Mozzarella fresca de vaca Hacendado', price_instructions: { unit_price: 0.90 }, thumbnail: 'https://prod-mercadona.imgix.net/images/mozzarella.jpg' }},
      { product_id: '16252', name: 'Bacon', quantity: '100g', product_data: { id: '16252', display_name: 'Bacón Hacendado cintas', price_instructions: { unit_price: 2.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/bacon.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '100g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '17151', name: 'Tomate/Ketchup', quantity: '100g', product_data: { id: '17151', display_name: 'Tomate frito Hacendado', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/tomate.jpg' }},
    ],
    instructions: [
      'Caramelizar la cebolla a fuego lento con un poco de azúcar',
      'Freír el bacon hasta que esté crujiente',
      'Cocinar las hamburguesas a la plancha 3-4 minutos por lado',
      'Poner el queso encima al final para que se funda',
      'Tostar los panes ligeramente',
      'Montar: pan, salsa, hamburguesa con queso, bacon, cebolla, pan'
    ]
  },
  {
    id: 'croquetas-jamon',
    name: 'Croquetas de Jamón Caseras',
    description: 'Cremosas croquetas de jamón con bechamel casera',
    servings: 6, time: '60 min', difficulty: 'Media',
    image: 'https://prod-mercadona.imgix.net/images/croquetas.jpg',
    ingredients: [
      { product_id: '16252', name: 'Jamón/Bacon', quantity: '200g', product_data: { id: '16252', display_name: 'Bacón Hacendado cintas', price_instructions: { unit_price: 2.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/bacon.jpg' }},
      { product_id: '10117', name: 'Nata para cocinar', quantity: '200ml', product_data: { id: '10117', display_name: 'Nata fresca para cocinar', price_instructions: { unit_price: 1.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/nata.jpg' }},
      { product_id: '13568', name: 'Cebolla', quantity: '100g', product_data: { id: '13568', display_name: 'Cebolla troceada ultracongelada', price_instructions: { unit_price: 0.95 }, thumbnail: 'https://prod-mercadona.imgix.net/images/cebolla.jpg' }},
      { product_id: '51203', name: 'Queso untar', quantity: '100g', product_data: { id: '51203', display_name: 'Queso untar suave de vaca Hacendado', price_instructions: { unit_price: 1.45 }, thumbnail: 'https://prod-mercadona.imgix.net/images/queso.jpg' }},
    ],
    instructions: [
      'Picar muy fino el jamón/bacon y la cebolla',
      'Sofreír la cebolla, añadir harina (60g) y hacer un roux',
      'Añadir leche (500ml) poco a poco, removiendo para evitar grumos',
      'Incorporar la nata, el queso y el jamón, cocinar hasta que espese',
      'Dejar enfriar la masa en la nevera mínimo 2 horas',
      'Formar las croquetas, pasar por huevo batido y pan rallado, freír'
    ]
  },
  {
    id: 'san-jacobo',
    name: 'San Jacobos Caseros',
    description: 'Filetes empanados rellenos de jamón y queso',
    servings: 4, time: '30 min', difficulty: 'Media',
    image: 'https://prod-mercadona.imgix.net/images/sanjacobo.jpg',
    ingredients: [
      { product_id: '14485', name: 'Filetes de pollo', quantity: '4 grandes', product_data: { id: '14485', display_name: 'Churrasco de pollo', price_instructions: { unit_price: 2.80 }, thumbnail: 'https://prod-mercadona.imgix.net/images/pollo.jpg' }},
      { product_id: '16252', name: 'Jamón/Bacon', quantity: '8 lonchas', product_data: { id: '16252', display_name: 'Bacón Hacendado cintas', price_instructions: { unit_price: 2.30 }, thumbnail: 'https://prod-mercadona.imgix.net/images/bacon.jpg' }},
      { product_id: '51050', name: 'Queso', quantity: '8 lonchas', product_data: { id: '51050', display_name: 'Mozzarella fresca de vaca Hacendado', price_instructions: { unit_price: 0.90 }, thumbnail: 'https://prod-mercadona.imgix.net/images/mozzarella.jpg' }},
    ],
    instructions: [
      'Abrir los filetes en libro o aplanarlos con un mazo',
      'Colocar jamón y queso encima, doblar y cerrar con palillos',
      'Pasar por harina, huevo batido y pan rallado',
      'Freír en abundante aceite caliente hasta que estén dorados',
      'Escurrir sobre papel absorbente',
      'Servir calientes con ensalada o patatas fritas'
    ]
  },
];

type TabType = 'home' | 'search' | 'list' | 'favorites' | 'recipes';

export default function Index() {
  const [deviceId, setDeviceId] = useState<string>('');
  const [postalCode, setPostalCode] = useState<string>('28001');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPostalModal, setShowPostalModal] = useState<boolean>(false);
  const [tempPostalCode, setTempPostalCode] = useState<string>('');
  const [budget, setBudget] = useState<number>(100);
  const [showBudgetModal, setShowBudgetModal] = useState<boolean>(false);
  const [tempBudget, setTempBudget] = useState<string>('100');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryPath, setCategoryPath] = useState<Category[]>([]);
  
  // Estado del buscador general
  const [generalSearchQuery, setGeneralSearchQuery] = useState<string>('');
  const [generalSearchResults, setGeneralSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  // Initialize device ID
  useEffect(() => {
    const getDeviceId = async () => {
      let id = '';
      if (Platform.OS === 'ios') {
        id = (await Application.getIosIdForVendorAsync()) || 'ios-default';
      } else if (Platform.OS === 'android') {
        id = Application.getAndroidId() || 'android-default';
      } else {
        // Web - use localStorage to persist device ID
        if (typeof window !== 'undefined' && window.localStorage) {
          const storedId = window.localStorage.getItem('mercadona_device_id');
          if (storedId) {
            id = storedId;
          } else {
            id = 'web-' + Math.random().toString(36).substring(7);
            window.localStorage.setItem('mercadona_device_id', id);
          }
        } else {
          id = 'web-' + Math.random().toString(36).substring(7);
        }
      }
      setDeviceId(id);
    };
    getDeviceId();
  }, []);

  // Load initial data
  useEffect(() => {
    if (deviceId) {
      loadCategories();
      loadShoppingList();
      loadFavorites();
    }
  }, [deviceId, postalCode]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/mercadona/categories?postal_code=${postalCode}`
      );
      if (response.ok) {
        const data = await response.json();
        setCategories(data.results || data || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryProducts = async (categoryId: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/mercadona/categories/${categoryId}?postal_code=${postalCode}`
      );
      if (response.ok) {
        const data = await response.json();
        
        // Extract all products from subcategories if they exist
        const allProducts: Product[] = [];
        if (data.categories && data.categories.length > 0) {
          data.categories.forEach((subcat: any) => {
            if (subcat.products && subcat.products.length > 0) {
              allProducts.push(...subcat.products);
            }
          });
        }
        
        // If we found products in subcategories, show them
        if (allProducts.length > 0) {
          setProducts(allProducts);
          setSelectedCategory(data);
        } else if (data.products && data.products.length > 0) {
          // Products directly in this category
          setProducts(data.products);
          setSelectedCategory(data);
        } else if (data.categories && data.categories.length > 0) {
          // Only subcategories without products - need to navigate deeper
          setProducts([]);
          setSelectedCategory(data);
        } else {
          // No products or subcategories
          setProducts([]);
          setSelectedCategory(data);
        }
      }
    } catch (error) {
      console.error('Error loading category:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadShoppingList = async () => {
    try {
      const response = await fetch(`${API_URL}/api/shopping-list/${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setShoppingList(data);
        setBudget(data.budget || 100);
      }
    } catch (error) {
      console.error('Error loading shopping list:', error);
    }
  };

  const loadFavorites = async () => {
    try {
      const response = await fetch(`${API_URL}/api/favorites/${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setFavorites(data);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const addToShoppingList = async (product: Product) => {
    try {
      const response = await fetch(`${API_URL}/api/shopping-list/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          product_id: product.id,
          product_data: product,
          quantity: 1,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setShoppingList(data);
        Alert.alert('Añadido', `${product.display_name || product.name} añadido a la lista`);
      }
    } catch (error) {
      console.error('Error adding to list:', error);
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    try {
      const response = await fetch(`${API_URL}/api/shopping-list/quantity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          product_id: productId,
          quantity: quantity,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setShoppingList(data);
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const toggleFavorite = async (product: Product) => {
    const isFavorite = favorites.some((f) => f.product_id === product.id);

    try {
      if (isFavorite) {
        await fetch(`${API_URL}/api/favorites/${deviceId}/${product.id}`, {
          method: 'DELETE',
        });
        setFavorites(favorites.filter((f) => f.product_id !== product.id));
      } else {
        const response = await fetch(`${API_URL}/api/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: deviceId,
            product_id: product.id,
            product_data: product,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setFavorites([...favorites, data]);
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const updatePostalCode = async () => {
    if (tempPostalCode.length === 5) {
      setPostalCode(tempPostalCode);
      setShowPostalModal(false);
      setSelectedCategory(null);
      setCategoryPath([]);
      setProducts([]);
    } else {
      Alert.alert('Error', 'El código postal debe tener 5 dígitos');
    }
  };

  const updateBudget = async () => {
    const newBudget = parseFloat(tempBudget);
    if (!isNaN(newBudget) && newBudget > 0) {
      setBudget(newBudget);
      try {
        await fetch(
          `${API_URL}/api/shopping-list/${deviceId}/budget?budget=${newBudget}`,
          { method: 'PUT' }
        );
      } catch (error) {
        console.error('Error updating budget:', error);
      }
      setShowBudgetModal(false);
    }
  };

  const clearShoppingList = async () => {
    // En web, Alert.alert no funciona bien, usamos confirm
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('¿Estás seguro de que quieres vaciar la lista?');
      if (confirmed) {
        try {
          const response = await fetch(`${API_URL}/api/shopping-list/${deviceId}/clear`, {
            method: 'DELETE',
          });
          if (response.ok) {
            setShoppingList((prev) => (prev ? { ...prev, items: [] } : null));
          }
        } catch (error) {
          console.error('Error clearing list:', error);
        }
      }
    } else {
      Alert.alert('Vaciar lista', '¿Estás seguro de que quieres vaciar la lista?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vaciar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/shopping-list/${deviceId}/clear`, {
                method: 'DELETE',
              });
              if (response.ok) {
                setShoppingList((prev) => (prev ? { ...prev, items: [] } : null));
              }
            } catch (error) {
              console.error('Error clearing list:', error);
            }
          },
        },
      ]);
    }
  };

  const getProductPrice = (product: Product): number => {
    const price = 
      product.price_instructions?.unit_price ||
      product.price_instructions?.bulk_price ||
      0;
    // Convert string prices to numbers (Mercadona API returns strings)
    return typeof price === 'string' ? parseFloat(price) || 0 : (price || 0);
  };

  const getProductImage = (product: Product): string | null => {
    // Primero intentar obtener del diccionario de imágenes reales por ID
    const realImage = PRODUCT_IMAGES[product.id];
    if (realImage) return realImage;
    
    // Verificar si la URL del thumbnail es válida (contiene hash, no un nombre simple)
    const isValidMercadonaUrl = (url: string | undefined): boolean => {
      if (!url) return false;
      // URLs válidas de Mercadona tienen un hash largo en el nombre del archivo
      // Ejemplo válido: /images/67d0e2f86e0f0a8e6c7ad8e5cf254a9d.jpg
      // Ejemplo inválido (placeholder): /images/tomate.jpg
      const hashPattern = /\/images\/[a-f0-9]{20,}\.(jpg|jpeg|png|webp)/i;
      return hashPattern.test(url);
    };
    
    // Solo usar thumbnail o photos si son URLs reales (no placeholders)
    const thumbnail = product.thumbnail;
    if (isValidMercadonaUrl(thumbnail)) return thumbnail!;
    
    const photoThumb = product.photos?.[0]?.thumbnail;
    if (isValidMercadonaUrl(photoThumb)) return photoThumb!;
    
    const photoRegular = product.photos?.[0]?.regular;
    if (isValidMercadonaUrl(photoRegular)) return photoRegular!;
    
    // Si no hay imagen válida, devolver null (se mostrará placeholder genérico)
    return null;
  };

  const getTotalPrice = (): number => {
    if (!shoppingList) return 0;
    return shoppingList.items.reduce((total, item) => {
      const price = getProductPrice(item.product_data);
      return total + price * item.quantity;
    }, 0);
  };

  const navigateToCategory = (category: Category) => {
    const newPath = [...categoryPath, category];
    setCategoryPath(newPath);
    
    // Check if the category already has products embedded
    if ((category as any).products && (category as any).products.length > 0) {
      setProducts((category as any).products);
      setSelectedCategory(category);
    } else if (category.categories && category.categories.length > 0) {
      // Has subcategories - check if they have products
      const allProducts: Product[] = [];
      category.categories.forEach((subcat: any) => {
        if (subcat.products && subcat.products.length > 0) {
          allProducts.push(...subcat.products);
        }
      });
      
      if (allProducts.length > 0) {
        setProducts(allProducts);
      } else {
        setProducts([]);
      }
      setSelectedCategory(category);
    } else {
      // Need to load products from API
      loadCategoryProducts(category.id);
    }
  };

  const goBackCategory = () => {
    if (categoryPath.length > 1) {
      const newPath = categoryPath.slice(0, -1);
      setCategoryPath(newPath);
      setSelectedCategory(newPath[newPath.length - 1]);
      setProducts([]);
    } else {
      setCategoryPath([]);
      setSelectedCategory(null);
      setProducts([]);
    }
  };

  // Función de búsqueda general de productos
  const performGeneralSearch = async (query: string) => {
    if (query.length < 2) {
      setGeneralSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setIsSearching(true);
    setShowSearchResults(true);
    try {
      const response = await fetch(
        `${API_URL}/api/mercadona/search?query=${encodeURIComponent(query)}&postal_code=${postalCode}`
      );
      if (response.ok) {
        const data = await response.json();
        setGeneralSearchResults(data.products || []);
      } else {
        setGeneralSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching products:', error);
      setGeneralSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearGeneralSearch = () => {
    setGeneralSearchQuery('');
    setGeneralSearchResults([]);
    setShowSearchResults(false);
  };

  // Product Card Component
  const ProductCard = ({ product }: { product: Product }) => {
    const isFavorite = favorites.some((f) => f.product_id === product.id);
    const imageUrl = getProductImage(product);
    const price = getProductPrice(product);

    return (
      <View style={styles.productCard}>
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(product)}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={24}
            color={isFavorite ? '#e74c3c' : '#666'}
          />
        </TouchableOpacity>

        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="cube-outline" size={40} color="#ccc" />
          </View>
        )}

        <Text style={styles.productName} numberOfLines={2}>
          {product.display_name || product.name}
        </Text>

        {product.packaging && (
          <Text style={styles.productPackaging}>{product.packaging}</Text>
        )}

        <Text style={styles.productPrice}>{price.toFixed(2)} €</Text>

        {product.price_instructions?.reference_price && (
          <Text style={styles.productRefPrice}>
            {product.price_instructions.reference_price}
          </Text>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => addToShoppingList(product)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Añadir</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render Home Tab
  const renderHomeTab = () => (
    <View style={styles.tabContent}>
      {/* Barra de búsqueda general */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar productos..."
            placeholderTextColor="#888"
            value={generalSearchQuery}
            onChangeText={(text) => {
              setGeneralSearchQuery(text);
              performGeneralSearch(text);
            }}
          />
          {generalSearchQuery.length > 0 && (
            <TouchableOpacity onPress={clearGeneralSearch} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Resultados de búsqueda */}
      {showSearchResults ? (
        <View style={styles.searchResultsContainer}>
          <View style={styles.searchResultsHeader}>
            <Text style={styles.searchResultsTitle}>
              Resultados para "{generalSearchQuery}" ({generalSearchResults.length})
            </Text>
            <TouchableOpacity onPress={clearGeneralSearch}>
              <Text style={styles.clearSearchText}>Limpiar</Text>
            </TouchableOpacity>
          </View>
          
          {isSearching ? (
            <ActivityIndicator size="large" color="#00a650" style={styles.loader} />
          ) : generalSearchResults.length > 0 ? (
            <ScrollView
              style={styles.productsList}
              contentContainerStyle={styles.productsGrid}
            >
              {generalSearchResults.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>No se encontraron productos</Text>
              <Text style={styles.emptyStateSubtext}>Prueba con otros términos de búsqueda</Text>
            </View>
          )}
        </View>
      ) : (
        <>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Categorías</Text>
            <TouchableOpacity
              style={styles.postalButton}
              onPress={() => {
                setTempPostalCode(postalCode);
                setShowPostalModal(true);
              }}
            >
              <Ionicons name="location" size={16} color="#00a650" />
              <Text style={styles.postalButtonText}>{postalCode}</Text>
            </TouchableOpacity>
          </View>

          {loading && !selectedCategory ? (
            <ActivityIndicator size="large" color="#00a650" style={styles.loader} />
          ) : selectedCategory || categoryPath.length > 0 ? (
            <View style={styles.categoryDetailView}>
              <TouchableOpacity style={styles.backButton} onPress={goBackCategory}>
                <Ionicons name="arrow-back" size={24} color="#00a650" />
                <Text style={styles.backButtonText}>
                  {categoryPath.length > 0
                    ? categoryPath[categoryPath.length - 1].name
                    : 'Categorías'}
                </Text>
              </TouchableOpacity>

              {products.length > 0 ? (
                <ScrollView
                  style={styles.productsList}
                  contentContainerStyle={styles.productsGrid}
                >
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
              ))}
            </ScrollView>
          ) : selectedCategory?.categories &&
          selectedCategory.categories.length > 0 ? (
            <ScrollView style={styles.subcategoriesList}>
              {selectedCategory.categories.map((subcat) => (
                <TouchableOpacity
                  key={subcat.id}
                  style={styles.subcategoryItem}
                  onPress={() => navigateToCategory(subcat)}
                >
                  <Text style={styles.subcategoryName}>{subcat.name}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : loading ? (
            <ActivityIndicator
              size="large"
              color="#00a650"
              style={styles.loader}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>No hay productos</Text>
            </View>
          )}
        </View>
      ) : (
        <ScrollView style={styles.categoriesList}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryItem}
              onPress={() => navigateToCategory(category)}
            >
              <View style={styles.categoryIcon}>
                <Ionicons name="grid-outline" size={24} color="#00a650" />
              </View>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
        </>
      )}
    </View>
  );

  // Render Shopping List Tab
  const renderListTab = () => {
    const total = getTotalPrice();
    const remaining = budget - total;
    const isOverBudget = remaining < 0;

    return (
      <View style={styles.tabContent}>
        <View style={styles.budgetHeader}>
          <View style={styles.budgetInfo}>
            <Text style={styles.budgetLabel}>Presupuesto</Text>
            <TouchableOpacity
              onPress={() => {
                setTempBudget(budget.toString());
                setShowBudgetModal(true);
              }}
            >
              <Text style={styles.budgetAmount}>{budget.toFixed(2)} €</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.budgetInfo}>
            <Text style={styles.budgetLabel}>Total</Text>
            <Text style={styles.totalAmount}>{total.toFixed(2)} €</Text>
          </View>
          <View style={styles.budgetInfo}>
            <Text style={styles.budgetLabel}>Restante</Text>
            <Text
              style={[
                styles.remainingAmount,
                isOverBudget && styles.overBudget,
              ]}
            >
              {remaining.toFixed(2)} €
            </Text>
          </View>
        </View>

        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min((total / budget) * 100, 100)}%`,
                backgroundColor: isOverBudget ? '#e74c3c' : '#00a650',
              },
            ]}
          />
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>
            Mi Lista ({shoppingList?.items.length || 0})
          </Text>
          {shoppingList && shoppingList.items.length > 0 && (
            <TouchableOpacity onPress={clearShoppingList}>
              <Text style={styles.clearButton}>Vaciar</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.shoppingListContainer}>
          {shoppingList?.items.map((item) => {
            const price = getProductPrice(item.product_data);
            const imageUrl = getProductImage(item.product_data);

            return (
              <View key={item.product_id} style={styles.listItem}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.listItemImage} />
                ) : (
                  <View style={styles.listItemImagePlaceholder}>
                    <Ionicons name="cube-outline" size={24} color="#ccc" />
                  </View>
                )}

                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemName} numberOfLines={2}>
                    {item.product_data.display_name || item.product_data.name}
                  </Text>
                  <Text style={styles.listItemPrice}>
                    {price.toFixed(2)} € x {item.quantity} ={' '}
                    {(price * item.quantity).toFixed(2)} €
                  </Text>
                </View>

                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.product_id, item.quantity - 1)}
                  >
                    <Ionicons name="remove" size={18} color="#00a650" />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.product_id, item.quantity + 1)}
                  >
                    <Ionicons name="add" size={18} color="#00a650" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {(!shoppingList || shoppingList.items.length === 0) && (
            <View style={styles.emptyState}>
              <Ionicons name="cart-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>Tu lista está vacía</Text>
              <Text style={styles.emptyStateSubtext}>
                Añade productos desde las categorías
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // Render Favorites Tab
  const renderFavoritesTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Mis Favoritos ({favorites.length})</Text>

      <ScrollView
        style={styles.productsList}
        contentContainerStyle={styles.productsGrid}
      >
        {favorites.map((fav) => (
          <ProductCard key={fav.id} product={fav.product_data} />
        ))}
      </ScrollView>

      {favorites.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={64} color="#ccc" />
          <Text style={styles.emptyStateText}>No tienes favoritos</Text>
          <Text style={styles.emptyStateSubtext}>
            Pulsa el corazón en los productos para guardarlos
          </Text>
        </View>
      )}
    </View>
  );

  // Render Recipes Tab
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [addingRecipeIngredients, setAddingRecipeIngredients] = useState<boolean>(false);
  const [selectedIngredients, setSelectedIngredients] = useState<{[key: string]: boolean}>({});
  
  // Estado para crear recetas personalizadas
  const [showCreateRecipe, setShowCreateRecipe] = useState<boolean>(false);
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>([]);
  const [newRecipeName, setNewRecipeName] = useState<string>('');
  const [newRecipeDescription, setNewRecipeDescription] = useState<string>('');
  const [newRecipeServings, setNewRecipeServings] = useState<string>('4');
  const [newRecipeTime, setNewRecipeTime] = useState<string>('30 min');
  const [newRecipeIngredients, setNewRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [showAddIngredient, setShowAddIngredient] = useState<boolean>(false);
  const [searchIngredient, setSearchIngredient] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState<boolean>(false);
  
  // Estado para editar recetas
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  // Cargar recetas personalizadas del backend
  useEffect(() => {
    if (deviceId) {
      loadCustomRecipes();
    }
  }, [deviceId]);

  const loadCustomRecipes = async () => {
    try {
      const response = await fetch(`${API_URL}/api/recipes/${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setCustomRecipes(data);
      }
    } catch (error) {
      console.error('Error loading custom recipes:', error);
    }
  };

  const searchProducts = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchingProducts(true);
    try {
      // Usar el nuevo endpoint de búsqueda
      const response = await fetch(
        `${API_URL}/api/mercadona/search?query=${encodeURIComponent(query)}&postal_code=${postalCode}`
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.products || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching products:', error);
      setSearchResults([]);
    } finally {
      setSearchingProducts(false);
    }
  };

  const addIngredientToNewRecipe = (product: Product, quantity: string) => {
    const newIngredient: RecipeIngredient = {
      product_id: product.id,
      name: product.display_name || product.name || '',
      quantity: quantity,
      product_data: {
        ...product,
        thumbnail: getProductImage(product) || product.thumbnail,
      },
    };
    setNewRecipeIngredients([...newRecipeIngredients, newIngredient]);
    setShowAddIngredient(false);
    setSearchIngredient('');
    setSearchResults([]);
  };

  const removeIngredientFromNewRecipe = (index: number) => {
    setNewRecipeIngredients(newRecipeIngredients.filter((_, i) => i !== index));
  };

  const saveNewRecipe = async () => {
    if (!newRecipeName.trim()) {
      Alert.alert('Error', 'Por favor introduce un nombre para la receta');
      return;
    }
    if (newRecipeIngredients.length === 0) {
      Alert.alert('Error', 'Por favor añade al menos un ingrediente');
      return;
    }

    try {
      const newRecipe = {
        device_id: deviceId,
        name: newRecipeName,
        description: newRecipeDescription,
        servings: parseInt(newRecipeServings) || 4,
        time: newRecipeTime,
        difficulty: 'Personal',
        ingredients: newRecipeIngredients,
        instructions: [],
      };

      const response = await fetch(`${API_URL}/api/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecipe),
      });

      if (response.ok) {
        await loadCustomRecipes();
        setShowCreateRecipe(false);
        resetNewRecipeForm();
        Alert.alert('¡Guardado!', 'Tu receta ha sido guardada');
      }
    } catch (error) {
      console.error('Error saving recipe:', error);
      Alert.alert('Error', 'No se pudo guardar la receta');
    }
  };

  const resetNewRecipeForm = () => {
    setNewRecipeName('');
    setNewRecipeDescription('');
    setNewRecipeServings('4');
    setNewRecipeTime('30 min');
    setNewRecipeIngredients([]);
    setEditingRecipe(null);
  };

  // Función para iniciar edición de receta
  const startEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setNewRecipeName(recipe.name);
    setNewRecipeDescription(recipe.description || '');
    setNewRecipeServings(String(recipe.servings));
    setNewRecipeTime(recipe.time);
    setNewRecipeIngredients([...recipe.ingredients]);
    setShowCreateRecipe(true);
  };

  // Función para guardar edición de receta
  const updateRecipe = async () => {
    if (!editingRecipe) return;
    
    if (!newRecipeName.trim()) {
      Alert.alert('Error', 'Por favor introduce un nombre para la receta');
      return;
    }
    if (newRecipeIngredients.length === 0) {
      Alert.alert('Error', 'Por favor añade al menos un ingrediente');
      return;
    }

    try {
      // Si es una receta duplicada (comienza con 'custom-'), crear una nueva
      const isNewRecipe = editingRecipe.id.startsWith('custom-') || editingRecipe.id.startsWith('recipe-');
      
      if (isNewRecipe) {
        // Crear nueva receta
        const response = await fetch(`${API_URL}/api/recipes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: deviceId,
            name: newRecipeName,
            description: newRecipeDescription,
            servings: parseInt(newRecipeServings) || 4,
            time: newRecipeTime,
            ingredients: newRecipeIngredients,
          }),
        });

        if (response.ok) {
          await loadCustomRecipes();
          setShowCreateRecipe(false);
          resetNewRecipeForm();
          Alert.alert('¡Guardado!', 'Tu receta personalizada ha sido creada');
        } else {
          throw new Error('Error al crear');
        }
      } else {
        // Actualizar receta existente
        const response = await fetch(`${API_URL}/api/recipes/${deviceId}/${editingRecipe.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newRecipeName,
            description: newRecipeDescription,
            servings: parseInt(newRecipeServings) || 4,
            time: newRecipeTime,
            ingredients: newRecipeIngredients,
          }),
        });

        if (response.ok) {
          await loadCustomRecipes();
          setShowCreateRecipe(false);
          resetNewRecipeForm();
          Alert.alert('¡Actualizado!', 'Tu receta ha sido actualizada');
        } else {
          throw new Error('Error al actualizar');
        }
      }
    } catch (error) {
      console.error('Error saving recipe:', error);
      Alert.alert('Error', 'No se pudo guardar la receta');
    }
  };

  const deleteCustomRecipe = async (recipeId: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('¿Eliminar esta receta?');
      if (confirmed) {
        try {
          await fetch(`${API_URL}/api/recipes/${deviceId}/${recipeId}`, {
            method: 'DELETE',
          });
          await loadCustomRecipes();
        } catch (error) {
          console.error('Error deleting recipe:', error);
        }
      }
    } else {
      Alert.alert('Eliminar receta', '¿Estás seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/api/recipes/${deviceId}/${recipeId}`, {
                method: 'DELETE',
              });
              await loadCustomRecipes();
            } catch (error) {
              console.error('Error deleting recipe:', error);
            }
          },
        },
      ]);
    }
  };

  // Initialize all ingredients as selected when recipe is selected
  const initializeIngredients = (recipe: Recipe) => {
    const initialSelection: {[key: string]: boolean} = {};
    recipe.ingredients.forEach(ing => {
      initialSelection[ing.product_id] = true;
    });
    setSelectedIngredients(initialSelection);
    setSelectedRecipe(recipe);
  };

  const toggleIngredient = (productId: string) => {
    setSelectedIngredients(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const selectAllIngredients = () => {
    if (selectedRecipe) {
      const allSelected: {[key: string]: boolean} = {};
      selectedRecipe.ingredients.forEach(ing => {
        allSelected[ing.product_id] = true;
      });
      setSelectedIngredients(allSelected);
    }
  };

  const deselectAllIngredients = () => {
    setSelectedIngredients({});
  };

  const getSelectedCount = (): number => {
    return Object.values(selectedIngredients).filter(Boolean).length;
  };

  const getSelectedPrice = (): number => {
    if (!selectedRecipe) return 0;
    return selectedRecipe.ingredients.reduce((total, ing) => {
      if (selectedIngredients[ing.product_id]) {
        return total + getProductPrice(ing.product_data);
      }
      return total;
    }, 0);
  };

  const addSelectedToList = async () => {
    if (!selectedRecipe) return;
    
    const ingredientsToAdd = selectedRecipe.ingredients.filter(
      ing => selectedIngredients[ing.product_id]
    );
    
    if (ingredientsToAdd.length === 0) {
      Alert.alert('Selecciona ingredientes', 'Por favor selecciona al menos un ingrediente');
      return;
    }

    setAddingRecipeIngredients(true);
    try {
      for (const ingredient of ingredientsToAdd) {
        await fetch(`${API_URL}/api/shopping-list/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: deviceId,
            product_id: ingredient.product_id,
            product_data: ingredient.product_data,
            quantity: 1,
          }),
        });
      }
      await loadShoppingList();
      Alert.alert(
        '¡Añadido!',
        `${ingredientsToAdd.length} ingrediente(s) añadidos a tu lista`,
        [{ text: 'Ver Lista', onPress: () => setActiveTab('list') }, { text: 'OK' }]
      );
    } catch (error) {
      console.error('Error adding ingredients:', error);
      Alert.alert('Error', 'No se pudieron añadir los ingredientes');
    } finally {
      setAddingRecipeIngredients(false);
    }
  };

  const addRecipeToList = async (recipe: Recipe) => {
    setAddingRecipeIngredients(true);
    try {
      for (const ingredient of recipe.ingredients) {
        await fetch(`${API_URL}/api/shopping-list/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: deviceId,
            product_id: ingredient.product_id,
            product_data: ingredient.product_data,
            quantity: 1,
          }),
        });
      }
      await loadShoppingList();
      Alert.alert(
        '¡Añadido!',
        `Los ingredientes de "${recipe.name}" se han añadido a tu lista de compra`,
        [{ text: 'Ver Lista', onPress: () => setActiveTab('list') }, { text: 'OK' }]
      );
    } catch (error) {
      console.error('Error adding recipe ingredients:', error);
      Alert.alert('Error', 'No se pudieron añadir los ingredientes');
    } finally {
      setAddingRecipeIngredients(false);
    }
  };

  const getRecipeTotalPrice = (recipe: Recipe): number => {
    return recipe.ingredients.reduce((total, ing) => {
      const price = getProductPrice(ing.product_data);
      return total + price;
    }, 0);
  };

  const renderRecipesTab = () => (
    <View style={styles.tabContent}>
      {selectedRecipe ? (
        // Recipe Detail View
        <ScrollView style={styles.recipeDetailContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setSelectedRecipe(null);
              setSelectedIngredients({});
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#00a650" />
            <Text style={styles.backButtonText}>Recetas</Text>
          </TouchableOpacity>

          <View style={styles.recipeDetailHeader}>
            <Text style={styles.recipeDetailTitle}>{selectedRecipe.name}</Text>
            <Text style={styles.recipeDetailDescription}>
              {selectedRecipe.description}
            </Text>

            <View style={styles.recipeMetaRow}>
              <View style={styles.recipeMeta}>
                <Ionicons name="time-outline" size={16} color="#666" />
                <Text style={styles.recipeMetaText}>{selectedRecipe.time}</Text>
              </View>
              <View style={styles.recipeMeta}>
                <Ionicons name="people-outline" size={16} color="#666" />
                <Text style={styles.recipeMetaText}>
                  {selectedRecipe.servings} pers.
                </Text>
              </View>
              <View style={styles.recipeMeta}>
                <Ionicons name="speedometer-outline" size={16} color="#666" />
                <Text style={styles.recipeMetaText}>
                  {selectedRecipe.difficulty}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.recipeSection}>
            <View style={styles.recipeSectionHeader}>
              <Text style={styles.recipeSectionTitle}>Ingredientes</Text>
              <View style={styles.selectButtons}>
                <TouchableOpacity onPress={selectAllIngredients} style={styles.selectBtn}>
                  <Text style={styles.selectBtnText}>Todos</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={deselectAllIngredients} style={styles.selectBtn}>
                  <Text style={styles.selectBtnText}>Ninguno</Text>
                </TouchableOpacity>
              </View>
            </View>

            {selectedRecipe.ingredients.map((ingredient, index) => {
              const isSelected = selectedIngredients[ingredient.product_id];
              return (
                <TouchableOpacity 
                  key={index} 
                  style={[
                    styles.ingredientItem,
                    isSelected && styles.ingredientItemSelected
                  ]}
                  onPress={() => toggleIngredient(ingredient.product_id)}
                >
                  <View style={[
                    styles.ingredientCheckbox,
                    isSelected && styles.ingredientCheckboxSelected
                  ]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                  {ingredient.product_data.thumbnail ? (
                    <Image
                      source={{ uri: ingredient.product_data.thumbnail }}
                      style={styles.ingredientImage}
                    />
                  ) : (
                    <View style={styles.ingredientImagePlaceholder}>
                      <Ionicons name="cube-outline" size={20} color="#ccc" />
                    </View>
                  )}
                  <View style={styles.ingredientInfo}>
                    <Text style={styles.ingredientName}>{ingredient.name}</Text>
                    <Text style={styles.ingredientQuantity}>
                      {ingredient.quantity}
                    </Text>
                  </View>
                  <Text style={styles.ingredientPrice}>
                    {getProductPrice(ingredient.product_data).toFixed(2)} €
                  </Text>
                </TouchableOpacity>
              );
            })}

            <View style={styles.selectedSummary}>
              <Text style={styles.selectedSummaryText}>
                {getSelectedCount()} seleccionados · {getSelectedPrice().toFixed(2)} €
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.addAllButton,
                addingRecipeIngredients && styles.addAllButtonDisabled,
                getSelectedCount() === 0 && styles.addAllButtonDisabled,
              ]}
              onPress={addSelectedToList}
              disabled={addingRecipeIngredients || getSelectedCount() === 0}
            >
              {addingRecipeIngredients ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="cart" size={20} color="#fff" />
                  <Text style={styles.addAllButtonText}>
                    Añadir seleccionados ({getSelectedCount()})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.recipeSection}>
            <Text style={styles.recipeSectionTitle}>Preparación</Text>
            {selectedRecipe.instructions.map((step, index) => (
              <View key={index} style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{step}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : showCreateRecipe ? (
        // Create Recipe View
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView style={styles.createRecipeContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setShowCreateRecipe(false);
                resetNewRecipeForm();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#00a650" />
              <Text style={styles.backButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <Text style={styles.createRecipeTitle}>
              {editingRecipe ? 'Editar Receta' : 'Nueva Receta'}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nombre de la receta *</Text>
              <TextInput
                style={styles.formInput}
                value={newRecipeName}
                onChangeText={setNewRecipeName}
                placeholder="Ej: Mi pasta favorita"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Descripción</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={newRecipeDescription}
                onChangeText={setNewRecipeDescription}
                placeholder="Describe tu receta..."
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.formLabel}>Porciones</Text>
                <TextInput
                  style={styles.formInput}
                  value={newRecipeServings}
                  onChangeText={setNewRecipeServings}
                  keyboardType="numeric"
                  placeholder="4"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.formLabel}>Tiempo</Text>
                <TextInput
                  style={styles.formInput}
                  value={newRecipeTime}
                  onChangeText={setNewRecipeTime}
                  placeholder="30 min"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.ingredientsHeader}>
                <Text style={styles.formLabel}>Ingredientes ({newRecipeIngredients.length})</Text>
                <TouchableOpacity
                  style={styles.addIngredientBtn}
                  onPress={() => setShowAddIngredient(true)}
                >
                  <Ionicons name="add-circle" size={24} color="#00a650" />
                  <Text style={styles.addIngredientBtnText}>Añadir</Text>
                </TouchableOpacity>
              </View>

              {newRecipeIngredients.map((ing, index) => (
                <View key={index} style={styles.newIngredientItem}>
                  <Text style={styles.newIngredientName}>{ing.name}</Text>
                  <Text style={styles.newIngredientQty}>{ing.quantity}</Text>
                  <TouchableOpacity onPress={() => removeIngredientFromNewRecipe(index)}>
                    <Ionicons name="close-circle" size={24} color="#e74c3c" />
                  </TouchableOpacity>
                </View>
              ))}

              {newRecipeIngredients.length === 0 && (
                <Text style={styles.noIngredientsText}>
                  Pulsa "Añadir" para buscar productos de Mercadona
                </Text>
              )}
            </View>

            <TouchableOpacity 
              style={styles.saveRecipeBtn} 
              onPress={editingRecipe ? updateRecipe : saveNewRecipe}
            >
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.saveRecipeBtnText}>
                {editingRecipe ? 'Actualizar Receta' : 'Guardar Receta'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Modal para añadir ingrediente */}
          <Modal visible={showAddIngredient} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Buscar Ingrediente</Text>
                  <TouchableOpacity onPress={() => {
                    setShowAddIngredient(false);
                    setSearchIngredient('');
                    setSearchResults([]);
                  }}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.searchInput}
                  value={searchIngredient}
                  onChangeText={(text) => {
                    setSearchIngredient(text);
                    searchProducts(text);
                  }}
                  placeholder="Buscar en Mercadona... (ej: tomate, pasta)"
                  autoFocus
                />

                {searchingProducts && (
                  <ActivityIndicator size="small" color="#00a650" style={{ marginTop: 10 }} />
                )}

                <ScrollView style={styles.searchResultsList}>
                  {searchResults.map((product) => (
                    <TouchableOpacity
                      key={product.id}
                      style={styles.searchResultItem}
                      onPress={() => {
                        const qty = Platform.OS === 'web' 
                          ? window.prompt('Cantidad (ej: 500g, 2 unidades):', '1 unidad') || '1 unidad'
                          : '1 unidad';
                        addIngredientToNewRecipe(product, qty);
                      }}
                    >
                      {getProductImage(product) ? (
                        <Image
                          source={{ uri: getProductImage(product)! }}
                          style={styles.searchResultImage}
                        />
                      ) : (
                        <View style={styles.searchResultImagePlaceholder}>
                          <Ionicons name="cube-outline" size={20} color="#ccc" />
                        </View>
                      )}
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName} numberOfLines={2}>
                          {product.display_name || product.name}
                        </Text>
                        <Text style={styles.searchResultPrice}>
                          {getProductPrice(product).toFixed(2)} €
                        </Text>
                      </View>
                      <Ionicons name="add-circle" size={28} color="#00a650" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      ) : (
        // Recipes List View
        <>
          <View style={styles.recipesHeader}>
            <Text style={styles.sectionTitle}>Recetas</Text>
            <TouchableOpacity
              style={styles.createRecipeBtn}
              onPress={() => setShowCreateRecipe(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createRecipeBtnText}>Crear</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.recipesSubtitle}>
            Selecciona ingredientes y añádelos a tu lista
          </Text>

          <ScrollView style={styles.recipesList}>
            {/* Recetas personalizadas */}
            {customRecipes.length > 0 && (
              <>
                <Text style={styles.recipesSectionLabel}>Mis Recetas ({customRecipes.length})</Text>
                {customRecipes.map((recipe) => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[styles.recipeCard, styles.customRecipeCard]}
                    onPress={() => initializeIngredients(recipe)}
                  >
                    <View style={styles.recipeCardContent}>
                      <View style={styles.recipeCardInfo}>
                        <View style={styles.customRecipeBadge}>
                          <Text style={styles.customRecipeBadgeText}>Personal</Text>
                        </View>
                        <Text style={styles.recipeCardTitle}>{recipe.name}</Text>
                        <Text style={styles.recipeCardDescription} numberOfLines={2}>
                          {recipe.description || 'Sin descripción'}
                        </Text>
                        <View style={styles.recipeCardMeta}>
                          <View style={styles.recipeCardMetaItem}>
                            <Ionicons name="restaurant-outline" size={14} color="#666" />
                            <Text style={styles.recipeCardMetaText}>
                              {recipe.ingredients.length} ingred.
                            </Text>
                          </View>
                          <Text style={styles.recipeCardPrice}>
                            ≈ {getRecipeTotalPrice(recipe).toFixed(2)} €
                          </Text>
                        </View>
                      </View>
                      <View style={styles.customRecipeActions}>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            startEditRecipe(recipe);
                          }}
                          style={{ marginBottom: 8 }}
                        >
                          <Ionicons name="create-outline" size={22} color="#3498db" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            deleteCustomRecipe(recipe.id);
                          }}
                        >
                          <Ionicons name="trash-outline" size={22} color="#e74c3c" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ marginTop: 12 }}
                          onPress={(e) => {
                            e.stopPropagation();
                            addRecipeToList(recipe);
                          }}
                        >
                          <Ionicons name="add-circle" size={32} color="#00a650" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Recetas predefinidas */}
            <Text style={styles.recipesSectionLabel}>Recetas Sugeridas ({PRELOADED_RECIPES.length})</Text>
            {PRELOADED_RECIPES.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCard}
                onPress={() => initializeIngredients(recipe)}
              >
                <View style={styles.recipeCardContent}>
                  <View style={styles.recipeCardInfo}>
                    <Text style={styles.recipeCardTitle}>{recipe.name}</Text>
                    <Text style={styles.recipeCardDescription} numberOfLines={2}>
                      {recipe.description}
                    </Text>
                    <View style={styles.recipeCardMeta}>
                      <View style={styles.recipeCardMetaItem}>
                        <Ionicons name="time-outline" size={14} color="#666" />
                        <Text style={styles.recipeCardMetaText}>
                          {recipe.time}
                        </Text>
                      </View>
                      <View style={styles.recipeCardMetaItem}>
                        <Ionicons name="restaurant-outline" size={14} color="#666" />
                        <Text style={styles.recipeCardMetaText}>
                          {recipe.ingredients.length} ingred.
                        </Text>
                      </View>
                      <Text style={styles.recipeCardPrice}>
                        ≈ {getRecipeTotalPrice(recipe).toFixed(2)} €
                      </Text>
                    </View>
                  </View>
                  <View style={styles.preloadedRecipeActions}>
                    <TouchableOpacity
                      style={styles.duplicateRecipeBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        // Duplicar la receta como una receta personal editable
                        const duplicatedRecipe: Recipe = {
                          ...recipe,
                          id: `custom-${Date.now()}`,
                          name: `${recipe.name} (Mi versión)`,
                        };
                        startEditRecipe(duplicatedRecipe);
                      }}
                    >
                      <Ionicons name="copy-outline" size={18} color="#3498db" />
                      <Text style={styles.duplicateRecipeBtnText}>Editar copia</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.recipeAddButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        addRecipeToList(recipe);
                      }}
                    >
                      <Ionicons name="add-circle" size={32} color="#00a650" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mercadona</Text>
        <Text style={styles.headerSubtitle}>Lista de Compra</Text>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {activeTab === 'home' && renderHomeTab()}
        {activeTab === 'list' && renderListTab()}
        {activeTab === 'favorites' && renderFavoritesTab()}
        {activeTab === 'recipes' && renderRecipesTab()}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            setActiveTab('home');
            setSelectedCategory(null);
            setCategoryPath([]);
            setProducts([]);
          }}
        >
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={24}
            color={activeTab === 'home' ? '#00a650' : '#666'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'home' && styles.tabLabelActive,
            ]}
          >
            Inicio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('list')}
        >
          <View>
            <Ionicons
              name={activeTab === 'list' ? 'cart' : 'cart-outline'}
              size={24}
              color={activeTab === 'list' ? '#00a650' : '#666'}
            />
            {shoppingList && shoppingList.items.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{shoppingList.items.length}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'list' && styles.tabLabelActive,
            ]}
          >
            Lista
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('favorites')}
        >
          <Ionicons
            name={activeTab === 'favorites' ? 'heart' : 'heart-outline'}
            size={24}
            color={activeTab === 'favorites' ? '#00a650' : '#666'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'favorites' && styles.tabLabelActive,
            ]}
          >
            Favoritos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('recipes')}
        >
          <Ionicons
            name={activeTab === 'recipes' ? 'book' : 'book-outline'}
            size={24}
            color={activeTab === 'recipes' ? '#00a650' : '#666'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'recipes' && styles.tabLabelActive,
            ]}
          >
            Recetas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Postal Code Modal */}
      <Modal visible={showPostalModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Código Postal</Text>
            <Text style={styles.modalSubtitle}>
              Introduce tu código postal para ver productos disponibles en tu zona
            </Text>
            <TextInput
              style={styles.modalInput}
              value={tempPostalCode}
              onChangeText={setTempPostalCode}
              keyboardType="numeric"
              maxLength={5}
              placeholder="Ej: 28001"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowPostalModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonConfirm}
                onPress={updatePostalCode}
              >
                <Text style={styles.modalButtonConfirmText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Budget Modal */}
      <Modal visible={showBudgetModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Presupuesto</Text>
            <Text style={styles.modalSubtitle}>
              Define tu presupuesto máximo para la compra
            </Text>
            <TextInput
              style={styles.modalInput}
              value={tempBudget}
              onChangeText={setTempBudget}
              keyboardType="decimal-pad"
              placeholder="Ej: 100"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowBudgetModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonConfirm}
                onPress={updateBudget}
              >
                <Text style={styles.modalButtonConfirmText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#00a650',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  mainContent: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  // Estilos del buscador general
  searchContainer: {
    marginBottom: 16,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#333',
  },
  clearSearchBtn: {
    padding: 4,
  },
  searchResultsContainer: {
    flex: 1,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  clearSearchText: {
    fontSize: 14,
    color: '#00a650',
    fontWeight: '500',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  postalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00a650',
  },
  postalButtonText: {
    marginLeft: 4,
    color: '#00a650',
    fontWeight: '600',
  },
  loader: {
    marginTop: 40,
  },
  categoriesList: {
    flex: 1,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  categoryDetailView: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#00a650',
  },
  subcategoriesList: {
    flex: 1,
  },
  subcategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  subcategoryName: {
    fontSize: 15,
    color: '#333',
  },
  productsList: {
    flex: 1,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  productImage: {
    width: '100%',
    height: 100,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  productImagePlaceholder: {
    width: '100%',
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    height: 36,
  },
  productPackaging: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00a650',
    marginBottom: 2,
  },
  productRefPrice: {
    fontSize: 11,
    color: '#999',
    marginBottom: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00a650',
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  budgetInfo: {
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  budgetAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00a650',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  remainingAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00a650',
  },
  overBudget: {
    color: '#e74c3c',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    color: '#e74c3c',
    fontWeight: '600',
  },
  shoppingListContainer: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
  },
  listItemImage: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    marginRight: 12,
  },
  listItemImagePlaceholder: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginRight: 12,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  listItemPrice: {
    fontSize: 13,
    color: '#00a650',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#00a650',
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButtonCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  modalButtonCancelText: {
    color: '#666',
    fontWeight: '600',
  },
  modalButtonConfirm: {
    backgroundColor: '#00a650',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalButtonConfirmText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Recipe Styles
  recipesSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  recipesList: {
    flex: 1,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recipeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeCardInfo: {
    flex: 1,
  },
  recipeCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  recipeCardDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  recipeCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeCardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  recipeCardMetaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  recipeCardPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00a650',
  },
  recipeAddButton: {
    padding: 8,
  },
  preloadedRecipeActions: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  duplicateRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f4fc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  duplicateRecipeBtnText: {
    fontSize: 11,
    color: '#3498db',
    fontWeight: '500',
  },
  recipeDetailContainer: {
    flex: 1,
  },
  recipeDetailHeader: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recipeDetailTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  recipeDetailDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeMetaText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  recipeSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recipeSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipeSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  recipeTotalPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00a650',
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ingredientImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  ingredientImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  ingredientQuantity: {
    fontSize: 12,
    color: '#666',
  },
  ingredientPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#00a650',
  },
  addAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00a650',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  addAllButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00a650',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  // Ingredient Selection Styles
  selectButtons: {
    flexDirection: 'row',
  },
  selectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    marginLeft: 8,
  },
  selectBtnText: {
    fontSize: 12,
    color: '#00a650',
    fontWeight: '500',
  },
  ingredientItemSelected: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    marginVertical: 2,
  },
  ingredientCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingredientCheckboxSelected: {
    backgroundColor: '#00a650',
    borderColor: '#00a650',
  },
  selectedSummary: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  selectedSummaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  // Create Recipe Styles
  recipesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  createRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00a650',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createRecipeBtnText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  createRecipeContainer: {
    flex: 1,
  },
  createRecipeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  formTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
  },
  ingredientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addIngredientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addIngredientBtnText: {
    color: '#00a650',
    fontWeight: '600',
    marginLeft: 4,
  },
  newIngredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  newIngredientName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  newIngredientQty: {
    fontSize: 13,
    color: '#666',
    marginRight: 12,
  },
  noIngredientsText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  saveRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00a650',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 40,
  },
  saveRecipeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  searchResultsList: {
    maxHeight: 300,
    marginTop: 12,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
  },
  searchResultImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  searchResultPrice: {
    fontSize: 13,
    color: '#00a650',
    marginTop: 2,
  },
  recipesSectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  customRecipeCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#00a650',
  },
  customRecipeBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  customRecipeBadgeText: {
    fontSize: 11,
    color: '#00a650',
    fontWeight: '600',
  },
  customRecipeActions: {
    alignItems: 'center',
  },
});
