#!/usr/bin/env python3
"""
Comprehensive backend testing for Mercadona Shopping List API
Tests all backend endpoints according to test_result.md requirements
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime
from typing import Dict, Any, List

# Backend URL from frontend .env configuration
BASE_URL = "https://mercadona-api-sync.preview.emergentagent.com/api"

class MercadonaAPITester:
    def __init__(self):
        self.session = None
        self.test_device_id = f"test-device-{int(datetime.now().timestamp())}"
        self.results = {
            "health_check": {"passed": False, "details": ""},
            "mercadona_categories": {"passed": False, "details": ""},
            "mercadona_category_products": {"passed": False, "details": ""},
            "shopping_list_crud": {"passed": False, "details": ""},
            "favorites_crud": {"passed": False, "details": ""},
            "user_settings": {"passed": False, "details": ""},
            "recipes_crud": {"passed": False, "details": ""}
        }
        
    async def setup(self):
        """Initialize HTTP session"""
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
        
    async def cleanup(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
            
    async def make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with error handling"""
        url = f"{BASE_URL}{endpoint}"
        try:
            async with self.session.request(method, url, **kwargs) as response:
                content_type = response.headers.get('content-type', '')
                if 'application/json' in content_type:
                    data = await response.json()
                else:
                    text = await response.text()
                    data = {"raw_response": text}
                
                return {
                    "status": response.status,
                    "data": data,
                    "headers": dict(response.headers)
                }
        except Exception as e:
            return {
                "status": 0,
                "data": {"error": str(e)},
                "headers": {}
            }

    async def test_health_check(self) -> bool:
        """Test 1: Health Check - GET /api/"""
        print("🔍 Testing Health Check...")
        
        response = await self.make_request("GET", "/")
        
        if response["status"] == 200:
            data = response["data"]
            if "status" in data and data["status"] == "running":
                self.results["health_check"] = {
                    "passed": True,
                    "details": "✅ Health check passed - API is running"
                }
                print("✅ Health Check: PASSED")
                return True
            else:
                self.results["health_check"] = {
                    "passed": False,
                    "details": f"❌ Wrong response format: {data}"
                }
        else:
            self.results["health_check"] = {
                "passed": False,
                "details": f"❌ HTTP {response['status']}: {response['data']}"
            }
        
        print(f"❌ Health Check: FAILED - {self.results['health_check']['details']}")
        return False

    async def test_mercadona_categories(self) -> bool:
        """Test 2: Mercadona Categories API - GET /api/mercadona/categories"""
        print("🔍 Testing Mercadona Categories API...")
        
        response = await self.make_request("GET", "/mercadona/categories", params={"postal_code": "28001"})
        
        if response["status"] == 200:
            data = response["data"]
            if "results" in data and isinstance(data["results"], list):
                categories_count = len(data["results"])
                if categories_count >= 20:  # Expecting around 26 categories
                    self.results["mercadona_categories"] = {
                        "passed": True,
                        "details": f"✅ Categories API working - Got {categories_count} categories"
                    }
                    print(f"✅ Mercadona Categories: PASSED - {categories_count} categories found")
                    return True
                else:
                    self.results["mercadona_categories"] = {
                        "passed": False,
                        "details": f"❌ Too few categories: {categories_count} (expected ~26)"
                    }
            else:
                self.results["mercadona_categories"] = {
                    "passed": False,
                    "details": f"❌ Wrong response format: {data}"
                }
        else:
            self.results["mercadona_categories"] = {
                "passed": False,
                "details": f"❌ HTTP {response['status']}: {response['data']}"
            }
        
        print(f"❌ Mercadona Categories: FAILED - {self.results['mercadona_categories']['details']}")
        return False

    async def test_mercadona_category_products(self) -> bool:
        """Test 3: Mercadona Category Products API"""
        print("🔍 Testing Mercadona Category Products API...")
        
        # Test Fruta category (ID: 27)
        response = await self.make_request("GET", "/mercadona/categories/27", params={"postal_code": "28001"})
        
        if response["status"] == 200:
            data = response["data"]
            if "categories" in data and isinstance(data["categories"], list):
                total_products = 0
                for category in data["categories"]:
                    if "products" in category:
                        total_products += len(category["products"])
                
                if total_products > 20:  # Expecting around 42 products in Fruta
                    self.results["mercadona_category_products"] = {
                        "passed": True,
                        "details": f"✅ Category products API working - Fruta has {total_products} products"
                    }
                    print(f"✅ Mercadona Category Products: PASSED - {total_products} products in Fruta")
                    return True
                else:
                    self.results["mercadona_category_products"] = {
                        "passed": False,
                        "details": f"❌ Too few products in Fruta: {total_products} (expected ~42)"
                    }
            else:
                self.results["mercadona_category_products"] = {
                    "passed": False,
                    "details": f"❌ Wrong response format: {data}"
                }
        else:
            self.results["mercadona_category_products"] = {
                "passed": False,
                "details": f"❌ HTTP {response['status']}: {response['data']}"
            }
        
        print(f"❌ Mercadona Category Products: FAILED - {self.results['mercadona_category_products']['details']}")
        return False

    async def test_shopping_list_crud(self) -> bool:
        """Test 4: Shopping List CRUD Operations"""
        print("🔍 Testing Shopping List CRUD...")
        
        try:
            # Step 1: Get/Create shopping list
            response = await self.make_request("GET", f"/shopping-list/{self.test_device_id}")
            if response["status"] != 200:
                self.results["shopping_list_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to get shopping list: HTTP {response['status']}"
                }
                print(f"❌ Shopping List CRUD: FAILED - Cannot get shopping list")
                return False
            
            # Step 2: Add product to shopping list
            product_data = {
                "device_id": self.test_device_id,
                "product_id": "52630",
                "product_data": {
                    "id": "52630",
                    "display_name": "Agua de Manantial",
                    "price_instructions": {"unit_price": 1.30}
                },
                "quantity": 1
            }
            
            response = await self.make_request("POST", "/shopping-list/add", json=product_data)
            if response["status"] != 200:
                self.results["shopping_list_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to add product: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ Shopping List CRUD: FAILED - Cannot add product")
                return False
            
            # Step 3: Update quantity
            quantity_data = {
                "device_id": self.test_device_id,
                "product_id": "52630",
                "quantity": 3
            }
            
            response = await self.make_request("PUT", "/shopping-list/quantity", json=quantity_data)
            if response["status"] != 200:
                self.results["shopping_list_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to update quantity: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ Shopping List CRUD: FAILED - Cannot update quantity")
                return False
            
            # Verify quantity was updated
            list_data = response["data"]
            if "items" in list_data and len(list_data["items"]) > 0:
                item = list_data["items"][0]
                if item["quantity"] != 3:
                    self.results["shopping_list_crud"] = {
                        "passed": False,
                        "details": f"❌ Quantity not updated correctly: got {item['quantity']}, expected 3"
                    }
                    print(f"❌ Shopping List CRUD: FAILED - Quantity not updated")
                    return False
            
            # Step 4: Update budget
            response = await self.make_request("PUT", f"/shopping-list/{self.test_device_id}/budget", params={"budget": 150})
            if response["status"] != 200:
                self.results["shopping_list_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to update budget: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ Shopping List CRUD: FAILED - Cannot update budget")
                return False
            
            # Step 5: Clear shopping list
            response = await self.make_request("DELETE", f"/shopping-list/{self.test_device_id}/clear")
            if response["status"] != 200:
                self.results["shopping_list_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to clear list: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ Shopping List CRUD: FAILED - Cannot clear list")
                return False
            
            self.results["shopping_list_crud"] = {
                "passed": True,
                "details": "✅ All shopping list operations working - GET, POST, PUT, DELETE"
            }
            print("✅ Shopping List CRUD: PASSED")
            return True
            
        except Exception as e:
            self.results["shopping_list_crud"] = {
                "passed": False,
                "details": f"❌ Exception during testing: {str(e)}"
            }
            print(f"❌ Shopping List CRUD: FAILED - {str(e)}")
            return False

    async def test_favorites_crud(self) -> bool:
        """Test 5: Favorites CRUD Operations"""
        print("🔍 Testing Favorites CRUD...")
        
        try:
            # Step 1: Get favorites (should be empty initially)
            response = await self.make_request("GET", f"/favorites/{self.test_device_id}")
            if response["status"] != 200:
                self.results["favorites_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to get favorites: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ Favorites CRUD: FAILED - Cannot get favorites")
                return False
            
            # Step 2: Add favorite
            favorite_data = {
                "device_id": self.test_device_id,
                "product_id": "15758",
                "product_data": {
                    "id": "15758",
                    "display_name": "Agua Pack-6",
                    "price_instructions": {"unit_price": 2.34}
                }
            }
            
            response = await self.make_request("POST", "/favorites", json=favorite_data)
            if response["status"] != 200:
                self.results["favorites_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to add favorite: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ Favorites CRUD: FAILED - Cannot add favorite")
                return False
            
            # Step 3: Verify favorite was added
            response = await self.make_request("GET", f"/favorites/{self.test_device_id}")
            if response["status"] != 200 or len(response["data"]) == 0:
                self.results["favorites_crud"] = {
                    "passed": False,
                    "details": f"❌ Favorite not found after adding: {response['data']}"
                }
                print(f"❌ Favorites CRUD: FAILED - Favorite not saved")
                return False
            
            # Step 4: Remove favorite
            response = await self.make_request("DELETE", f"/favorites/{self.test_device_id}/15758")
            if response["status"] != 200:
                self.results["favorites_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to remove favorite: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ Favorites CRUD: FAILED - Cannot remove favorite")
                return False
            
            # Step 5: Verify favorite was removed
            response = await self.make_request("GET", f"/favorites/{self.test_device_id}")
            if response["status"] != 200:
                self.results["favorites_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to verify removal: HTTP {response['status']}"
                }
                print(f"❌ Favorites CRUD: FAILED - Cannot verify removal")
                return False
            
            if len(response["data"]) != 0:
                self.results["favorites_crud"] = {
                    "passed": False,
                    "details": f"❌ Favorite not removed: still {len(response['data'])} favorites"
                }
                print(f"❌ Favorites CRUD: FAILED - Favorite not removed")
                return False
            
            self.results["favorites_crud"] = {
                "passed": True,
                "details": "✅ All favorites operations working - GET, POST, DELETE"
            }
            print("✅ Favorites CRUD: PASSED")
            return True
            
        except Exception as e:
            self.results["favorites_crud"] = {
                "passed": False,
                "details": f"❌ Exception during testing: {str(e)}"
            }
            print(f"❌ Favorites CRUD: FAILED - {str(e)}")
            return False

    async def test_user_settings(self) -> bool:
        """Test 6: User Settings Operations"""
        print("🔍 Testing User Settings...")
        
        try:
            # Step 1: Get settings (should create default if not exists)
            response = await self.make_request("GET", f"/settings/{self.test_device_id}")
            if response["status"] != 200:
                self.results["user_settings"] = {
                    "passed": False,
                    "details": f"❌ Failed to get settings: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ User Settings: FAILED - Cannot get settings")
                return False
            
            settings_data = response["data"]
            if "device_id" not in settings_data or settings_data["device_id"] != self.test_device_id:
                self.results["user_settings"] = {
                    "passed": False,
                    "details": f"❌ Wrong device_id in response: {settings_data}"
                }
                print(f"❌ User Settings: FAILED - Wrong device_id")
                return False
            
            # Step 2: Update settings
            update_data = {
                "postal_code": "08001",
                "budget": 200
            }
            
            response = await self.make_request("PUT", f"/settings/{self.test_device_id}", json=update_data)
            if response["status"] != 200:
                self.results["user_settings"] = {
                    "passed": False,
                    "details": f"❌ Failed to update settings: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ User Settings: FAILED - Cannot update settings")
                return False
            
            # Step 3: Verify settings were updated
            updated_settings = response["data"]
            if (updated_settings["postal_code"] != "08001" or 
                updated_settings["budget"] != 200 or
                updated_settings["warehouse"] != "bcn1"):  # Should auto-set warehouse based on postal code
                self.results["user_settings"] = {
                    "passed": False,
                    "details": f"❌ Settings not updated correctly: {updated_settings}"
                }
                print(f"❌ User Settings: FAILED - Settings not updated")
                return False
            
            self.results["user_settings"] = {
                "passed": True,
                "details": "✅ User settings working - GET, PUT with warehouse auto-assignment"
            }
            print("✅ User Settings: PASSED")
            return True
            
        except Exception as e:
            self.results["user_settings"] = {
                "passed": False,
                "details": f"❌ Exception during testing: {str(e)}"
            }
            print(f"❌ User Settings: FAILED - {str(e)}")
            return False

    async def test_recipes_crud(self) -> bool:
        """Test 7: Recipes CRUD Operations (Basic functionality)"""
        print("🔍 Testing Recipes CRUD...")
        
        try:
            # Step 1: Get recipes (should be empty initially)
            response = await self.make_request("GET", f"/recipes/{self.test_device_id}")
            if response["status"] != 200:
                self.results["recipes_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to get recipes: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ Recipes CRUD: FAILED - Cannot get recipes")
                return False
            
            # Step 2: Create recipe
            recipe_data = {
                "device_id": self.test_device_id,
                "name": "Test Recipe",
                "description": "A test recipe for API validation",
                "ingredients": [
                    {"name": "Test Ingredient", "quantity": "1 unit"}
                ],
                "instructions": "Test instructions",
                "servings": 2
            }
            
            response = await self.make_request("POST", "/recipes", json=recipe_data)
            if response["status"] != 200:
                self.results["recipes_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to create recipe: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ Recipes CRUD: FAILED - Cannot create recipe")
                return False
            
            created_recipe = response["data"]
            recipe_id = created_recipe["id"]
            
            # Step 3: Get specific recipe
            response = await self.make_request("GET", f"/recipes/{self.test_device_id}/{recipe_id}")
            if response["status"] != 200:
                self.results["recipes_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to get specific recipe: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ Recipes CRUD: FAILED - Cannot get specific recipe")
                return False
            
            # Step 4: Delete recipe
            response = await self.make_request("DELETE", f"/recipes/{self.test_device_id}/{recipe_id}")
            if response["status"] != 200:
                self.results["recipes_crud"] = {
                    "passed": False,
                    "details": f"❌ Failed to delete recipe: HTTP {response['status']}: {response['data']}"
                }
                print(f"❌ Recipes CRUD: FAILED - Cannot delete recipe")
                return False
            
            self.results["recipes_crud"] = {
                "passed": True,
                "details": "✅ Basic recipes operations working - GET, POST, DELETE"
            }
            print("✅ Recipes CRUD: PASSED")
            return True
            
        except Exception as e:
            self.results["recipes_crud"] = {
                "passed": False,
                "details": f"❌ Exception during testing: {str(e)}"
            }
            print(f"❌ Recipes CRUD: FAILED - {str(e)}")
            return False

    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all backend tests"""
        print(f"🚀 Starting Mercadona API Backend Tests")
        print(f"📍 Backend URL: {BASE_URL}")
        print(f"🔧 Test Device ID: {self.test_device_id}")
        print("=" * 60)
        
        await self.setup()
        
        # Run tests in order
        test_functions = [
            self.test_health_check,
            self.test_mercadona_categories,
            self.test_mercadona_category_products,
            self.test_shopping_list_crud,
            self.test_favorites_crud,
            self.test_user_settings,
            self.test_recipes_crud
        ]
        
        passed_count = 0
        total_count = len(test_functions)
        
        for test_func in test_functions:
            try:
                if await test_func():
                    passed_count += 1
            except Exception as e:
                print(f"❌ Test {test_func.__name__} crashed: {str(e)}")
        
        await self.cleanup()
        
        print("=" * 60)
        print(f"📊 Test Results: {passed_count}/{total_count} tests passed")
        
        return {
            "summary": {
                "total": total_count,
                "passed": passed_count,
                "failed": total_count - passed_count
            },
            "results": self.results
        }

def print_detailed_results(results: Dict[str, Any]):
    """Print detailed test results"""
    print("\n📋 DETAILED RESULTS:")
    print("=" * 60)
    
    for test_name, result in results["results"].items():
        status = "✅ PASSED" if result["passed"] else "❌ FAILED"
        print(f"{test_name}: {status}")
        if result["details"]:
            print(f"   {result['details']}")
        print()

async def main():
    """Main test runner"""
    tester = MercadonaAPITester()
    results = await tester.run_all_tests()
    
    print_detailed_results(results)
    
    # Return exit code based on results
    if results["summary"]["failed"] > 0:
        print("❌ Some tests failed!")
        sys.exit(1)
    else:
        print("✅ All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())