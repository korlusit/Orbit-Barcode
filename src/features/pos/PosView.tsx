import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Scanner } from './Scanner';
import { getSelectedCameraId } from '@/features/settings/SettingsView';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Search, Trash2, Plus, Minus, ScanBarcode, CreditCard, Banknote, PackagePlus } from 'lucide-react';
import { getDatabase } from '@/lib/rxdb/db';
import type { Product, Order } from '@/lib/rxdb/schema';
import { v4 as uuidv4 } from 'uuid';

// --- SES EFEKTLERİ (Web Audio API) ---
const playSound = (type: 'success' | 'error' | 'warning') => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'warning') {
        // Distinct double-beep: 600Hz → 800Hz
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.12);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.25);
    } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    }
};

// --- TİP TANIMLAMALARI ---
interface CartItem {
    product: Product;
    qty: number;
}

interface LastScan {
    code: string;
    productName: string | null;
    found: boolean;
    timestamp: number;
}

export const PosView = () => {
    const location = useLocation();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [manualCode, setManualCode] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastScanned, setLastScanned] = useState<LastScan | null>(null);
    const [selectedCameraId, setSelectedCameraId] = useState<string | null>(getSelectedCameraId());

    // Her sayfa geçişinde localStorage'dan güncel kamerayı oku
    useEffect(() => {
        setSelectedCameraId(getSelectedCameraId());
    }, [location.pathname]);
    // --- BARKOD OKUMA MANTIĞI ---
    const handleScan = async (code: string) => {
        if (isProcessing) return;
        setIsProcessing(true);

        // Her zaman okunan kodu göster
        setLastScanned({ code, productName: null, found: false, timestamp: Date.now() });

        try {
            const db = await getDatabase();
            const productDoc = await db.products.findOne({
                selector: { barcode: code }
            }).exec();

            if (productDoc) {
                const product = productDoc.toJSON() as Product;
                setLastScanned({ code, productName: product.name, found: true, timestamp: Date.now() });
                addToCart(product);
                playSound('success');
            } else {
                // Ürün bulunamadı — uyarı sesi, alert yok
                setLastScanned({ code, productName: null, found: false, timestamp: Date.now() });
                playSound('warning');
            }
        } catch (error) {
            console.error("Okuma hatası:", error);
        } finally {
            setTimeout(() => setIsProcessing(false), 500);
        }
    };

    // --- SEPET FONKSİYONLARI ---
    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                // Varsa adeti arttır
                return prev.map(item => 
                    item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
                );
            }
            // Yoksa yeni ekle
            return [...prev, { product, qty: 1 }];
        });
    };

    const updateQty = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === id) {
                const newQty = Math.max(1, item.qty + delta);
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.product.id !== id));
    };

    // --- SATIŞI TAMAMLAMA (CHECKOUT) ---
    const handleCheckout = async (paymentMethod: 'cash' | 'card') => {
        if (cart.length === 0) return;

        try {
            const db = await getDatabase();
            const totalAmount = cart.reduce((acc, item) => acc + (item.product.price * item.qty), 0);
            
            // Siparişi Oluştur
            const newOrder: Order = {
                id: uuidv4(), // Benzersiz ID
                // user_id: 'user_id_placeholder', // Supabase Auth eklendiğinde burası dolacak
                items: cart.map(item => ({
                    product_id: item.product.id,
                    name: item.product.name,
                    quantity: item.qty,
                    price: item.product.price
                })),
                total: totalAmount,
                subtotal: totalAmount, // Vergi hesabı eklenirse düşülür
                tax: 0,
                status: 'completed',
                created_at: Date.now(),
                payment_method: paymentMethod
            };

            // Veritabanına Yaz (RxDB -> Supabase'e otomatik gidecek)
            await db.orders.insert(newOrder);

            // Temizlik
            playSound('success');
            setCart([]);
            alert("Satış Başarılı! ✅");
        } catch (error) {
            console.error("Satış hatası:", error);
            playSound('error');
            alert("Satış kaydedilemedi!");
        }
    };

    // --- TOPLAM HESAPLAMA ---
    const total = cart.reduce((acc, item) => acc + (item.product.price * item.qty), 0);

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black p-3 space-y-3">
            {/* ÜST BAR: Arama ve Manuel Giriş */}
            <header className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <Input 
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleScan(manualCode);
                                setManualCode('');
                            }
                        }}
                        placeholder="Barkod yaz veya Ara..." 
                        className="pl-10 bg-white dark:bg-gray-900 border-none shadow-sm h-12 text-lg" 
                    />
                </div>
                <Button variant="outline" size="icon" className="shrink-0 h-12 w-12 rounded-xl">
                   <div className="relative">
                        <ShoppingCart size={24} />
                        {cart.length > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                                {cart.length}
                            </span>
                        )}
                   </div>
                </Button>
            </header>

            {/* KAMERA ALANI */}
            <div className="shrink-0">
                <Scanner onScan={handleScan} cameraId={selectedCameraId} className="border-none shadow-md bg-black rounded-2xl overflow-hidden h-[300px]" />
            </div>

            {/* SON OKUNAN BARKOD */}
            {lastScanned && (
                <Card className={`p-3 flex items-center justify-between border-none shadow-sm animate-in fade-in slide-in-from-top-2 ${
                    lastScanned.found
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-300 dark:ring-emerald-700'
                        : 'bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-300 dark:ring-amber-700'
                }`}>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${
                            lastScanned.found ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                            {lastScanned.found ? '✅ Ürün Bulundu' : '⚠️ Tanınmayan Barkod'}
                        </span>
                        <span className="font-mono text-lg font-bold truncate">{lastScanned.code}</span>
                        {lastScanned.found && lastScanned.productName && (
                            <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{lastScanned.productName}</span>
                        )}
                    </div>
                    {!lastScanned.found && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="ml-3 shrink-0 border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-semibold"
                            onClick={() => {
                                console.log('Quick Add:', lastScanned.code);
                            }}
                        >
                            <PackagePlus size={16} className="mr-1.5" />
                            Hızlı Ekle
                        </Button>
                    )}
                </Card>
            )}

            {/* SEPET LİSTESİ */}
            <div className="flex-1 overflow-y-auto space-y-2 pb-20 no-scrollbar">
                {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 opacity-50">
                        <ScanBarcode size={48} />
                        <p className="mt-2 text-sm">Ürün okutun veya arayın</p>
                    </div>
                ) : (
                    cart.map(item => (
                        <Card key={item.product.id} className="p-3 flex items-center justify-between shadow-sm border-none bg-white dark:bg-gray-900 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex flex-col flex-1">
                                <span className="font-semibold text-lg leading-tight">{item.product.name}</span>
                                <span className="text-gray-500 text-sm font-mono">{item.product.price.toFixed(2)} ₺</span>
                            </div>
                            
                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-md hover:bg-white hover:shadow-sm"
                                    onClick={() => updateQty(item.product.id, -1)}
                                >
                                    <Minus size={16} />
                                </Button>
                                <span className="font-bold w-6 text-center text-lg">{item.qty}</span>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-md hover:bg-white hover:shadow-sm"
                                    onClick={() => updateQty(item.product.id, 1)}
                                >
                                    <Plus size={16} />
                                </Button>
                            </div>

                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 ml-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => removeFromCart(item.product.id)}
                            >
                                <Trash2 size={18} />
                            </Button>
                        </Card>
                    ))
                )}
            </div>

            {/* ALT PANEL: Toplam ve Ödeme */}
            <div className="fixed bottom-[70px] left-0 right-0 p-4 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 z-10">
                <div className="flex justify-between items-end mb-3">
                     <span className="text-gray-500 font-medium">Toplam Tutar</span>
                     <span className="text-4xl font-black tracking-tight">{total.toFixed(2)} ₺</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <Button 
                        variant="outline" 
                        size="huge" 
                        className="rounded-xl border-2 border-gray-200 hover:bg-gray-50 text-gray-700 h-14"
                        onClick={() => handleCheckout('cash')}
                    >
                        <Banknote className="mr-2" /> Nakit
                    </Button>
                    <Button 
                        variant="success" 
                        size="huge" 
                        className="rounded-xl h-14 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20"
                        onClick={() => handleCheckout('card')}
                    >
                        <CreditCard className="mr-2" /> Kart
                    </Button>
                </div>
            </div>
        </div>
    );
};