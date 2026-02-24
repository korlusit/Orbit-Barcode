import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, CheckCircle2, RefreshCw } from 'lucide-react';

interface CameraDevice {
    id: string;
    label: string;
}

const CAMERA_STORAGE_KEY = 'orbit_selected_camera';

export const getSelectedCameraId = (): string | null => {
    return localStorage.getItem(CAMERA_STORAGE_KEY);
};

export const SettingsView = () => {
    const [cameras, setCameras] = useState<CameraDevice[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(getSelectedCameraId());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadCameras = async () => {
        setLoading(true);
        setError(null);
        try {
            // Request camera permission first
            await navigator.mediaDevices.getUserMedia({ video: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices
                .filter(d => d.kind === 'videoinput')
                .map((d, i) => ({
                    id: d.deviceId,
                    label: d.label || `Kamera ${i + 1}`,
                }));
            setCameras(videoDevices);

            // If previously selected camera is no longer available, clear selection
            if (selectedId && !videoDevices.find(d => d.id === selectedId)) {
                setSelectedId(null);
                localStorage.removeItem(CAMERA_STORAGE_KEY);
            }
        } catch (err) {
            console.error('Kamera listesi alınamadı:', err);
            setError('Kamera izni verilmedi veya kameralar listelenemedi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCameras();
    }, []);

    const selectCamera = (id: string) => {
        setSelectedId(id);
        localStorage.setItem(CAMERA_STORAGE_KEY, id);
    };

    const clearSelection = () => {
        setSelectedId(null);
        localStorage.removeItem(CAMERA_STORAGE_KEY);
    };

    return (
        <div className="flex flex-col h-full p-4 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black tracking-tight">Ayarlar</h1>
                <p className="text-gray-500 text-sm mt-1">Uygulama tercihlerini yönetin</p>
            </div>

            {/* Camera Selection Section */}
            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Camera size={20} className="text-gray-500" />
                        <h2 className="text-lg font-semibold">Kamera Seçimi</h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadCameras}
                        disabled={loading}
                        className="text-gray-500"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>

                {error && (
                    <Card className="p-3 bg-red-50 dark:bg-red-950/30 border-none text-red-600 dark:text-red-400 text-sm">
                        {error}
                    </Card>
                )}

                {/* Default option */}
                <Card
                    className={`p-4 flex items-center justify-between cursor-pointer transition-all border-none shadow-sm ${
                        !selectedId
                            ? 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500'
                            : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={clearSelection}
                >
                    <div className="flex flex-col">
                        <span className="font-semibold">Otomatik (Arka Kamera)</span>
                        <span className="text-xs text-gray-500">Varsayılan — facingMode: environment</span>
                    </div>
                    {!selectedId && (
                        <CheckCircle2 size={22} className="text-blue-500 shrink-0" />
                    )}
                </Card>

                {/* Camera list */}
                {cameras.map((cam) => (
                    <Card
                        key={cam.id}
                        className={`p-4 flex items-center justify-between cursor-pointer transition-all border-none shadow-sm ${
                            selectedId === cam.id
                                ? 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500'
                                : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => selectCamera(cam.id)}
                    >
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-semibold truncate">{cam.label}</span>
                            <span className="text-xs text-gray-400 font-mono truncate">{cam.id.slice(0, 24)}…</span>
                        </div>
                        {selectedId === cam.id && (
                            <CheckCircle2 size={22} className="text-blue-500 shrink-0 ml-3" />
                        )}
                    </Card>
                ))}

                {cameras.length === 0 && !error && !loading && (
                    <p className="text-sm text-gray-400 text-center py-4">
                        Kamera bulunamadı. Yenile butonuna basın.
                    </p>
                )}

                {loading && (
                    <p className="text-sm text-gray-400 text-center py-4 animate-pulse">
                        Kameralar yükleniyor…
                    </p>
                )}
            </section>
        </div>
    );
};
