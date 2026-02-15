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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

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
    Alert.alert('Vaciar lista', '¿Estás seguro de que quieres vaciar la lista?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Vaciar',
        style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${API_URL}/api/shopping-list/${deviceId}/clear`, {
              method: 'DELETE',
            });
            setShoppingList((prev) => (prev ? { ...prev, items: [] } : null));
          } catch (error) {
            console.error('Error clearing list:', error);
          }
        },
      },
    ]);
  };

  const getProductPrice = (product: Product): number => {
    return (
      product.price_instructions?.unit_price ||
      product.price_instructions?.bulk_price ||
      0
    );
  };

  const getProductImage = (product: Product): string | null => {
    return (
      product.thumbnail ||
      product.photos?.[0]?.thumbnail ||
      product.photos?.[0]?.regular ||
      null
    );
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

  // Render Recipes Tab (placeholder for now)
  const renderRecipesTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Mis Recetas</Text>
      <View style={styles.emptyState}>
        <Ionicons name="book-outline" size={64} color="#ccc" />
        <Text style={styles.emptyStateText}>Próximamente</Text>
        <Text style={styles.emptyStateSubtext}>
          Podrás crear recetas y añadir ingredientes a tu lista
        </Text>
      </View>
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
});
