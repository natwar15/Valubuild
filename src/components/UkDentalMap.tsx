import React, { useEffect, useState, useCallback } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import { MapPin, Compass, ExternalLink, Search, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatGbp } from '../utils/valuationEngine';
import type { Cell, ListingsSummary } from '../shared/marketStats';

const REGION_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'London & South East': { lat: 51.35, lng: -0.25 },
  Midlands: { lat: 52.48, lng: -1.89 },
  'North West': { lat: 53.48, lng: -2.24 },
  'Yorkshire & Humber': { lat: 53.96, lng: -1.35 },
  'South West': { lat: 51.45, lng: -2.59 },
  'East of England': { lat: 52.21, lng: 0.12 },
  Scotland: { lat: 55.95, lng: -3.19 },
  Wales: { lat: 51.48, lng: -3.18 },
  'North East': { lat: 54.97, lng: -1.61 },
};

interface GroundedPlace {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets: Array<{ text?: string; uri?: string }>;
}

interface UkDentalMapProps {
  defaultRegion?: string;
}

export const UkDentalMap: React.FC<UkDentalMapProps> = ({
  defaultRegion = 'Yorkshire & Humber',
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  // One pin per region, built from public listing aggregates (never individual practices).
  const [regionCells, setRegionCells] = useState<Cell[]>([]);
  const [selectedPin, setSelectedPin] = useState<(Cell & { position: { lat: number; lng: number } }) | null>(null);

  // Google Maps Grounding local catchment intelligence state
  const [catchmentRegion, setCatchmentRegion] = useState<string>(defaultRegion);
  const [customTown, setCustomTown] = useState<string>('');
  const [loadingCatchment, setLoadingCatchment] = useState(false);
  const [catchmentMarkdown, setCatchmentMarkdown] = useState<string>('');
  const [groundedPlaces, setGroundedPlaces] = useState<GroundedPlace[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadRegions = useCallback(async () => {
    try {
      const res = await apiFetch<{ summary: ListingsSummary }>('/api/market/summary');
      setRegionCells(res.summary.byRegion || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load regional map data.');
    }
  }, []);

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  const mappedPins = regionCells
    .filter((c) => !c.suppressed && REGION_CENTROIDS[c.key])
    .map((c) => ({ ...c, position: REGION_CENTROIDS[c.key] }));

  const handleRunCatchmentAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingCatchment(true);
    setError(null);

    const coords = REGION_CENTROIDS[catchmentRegion] || { lat: 53.96, lng: -1.35 };
    const locationQuery = customTown.trim()
      ? `${customTown.trim()}, ${catchmentRegion}, UK`
      : `${catchmentRegion}, UK`;

    try {
      const res = await apiFetch<{
        analysisMarkdown: string;
        places: GroundedPlace[];
      }>('/api/ai/catchment-intelligence', {
        method: 'POST',
        body: JSON.stringify({
          region: catchmentRegion,
          locationQuery,
          latitude: coords.lat,
          longitude: coords.lng,
        }),
      });

      setCatchmentMarkdown(res.analysisMarkdown || '');
      setGroundedPlaces(res.places || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run local catchment analysis.');
    } finally {
      setLoadingCatchment(false);
    }
  };

  return (
    <div className="space-y-8 text-left">
      {/* Interactive UK Anonymised Dental Valuation Map */}
      <div className="bg-white border rounded-[6px] p-6 sm:p-8 space-y-5" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FAF5EE] text-[#A6521C] border border-[#D6BC9E]">
              UK Regional Valuation Map
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold mt-2 text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
              Practice prices across Great Britain
            </h2>
            <p className="text-sm text-[#6B6459] mt-1">
              One pin per region, summarising public broker listings. Click a pin for the median asking price and goodwill as a share of fees. Regions with fewer than 5 listings are not shown.
            </p>
          </div>

        </div>

        {!apiKey ? (
          <div className="h-[360px] rounded-[6px] border bg-[#FAF8F4] flex flex-col items-center justify-center p-6 text-center" style={{ borderColor: 'var(--color-border)' }}>
            <MapPin className="w-8 h-8 text-[#A6521C] mb-2" />
            <p className="text-sm font-bold text-[#26231E]">Google Maps key pending runtime injection</p>
            <p className="text-xs text-[#6B6459] max-w-md mt-1">
              Ensure VITE_GOOGLE_MAPS_API_KEY is available in the environment and reload to display interactive UK regional clinic markers.
            </p>
          </div>
        ) : (
          <div className="w-full h-[480px] rounded-[6px] overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
            <APIProvider apiKey={apiKey} language="en-GB" region="GB">
              <GoogleMap
                defaultCenter={{ lat: 53.55, lng: -2.0 }}
                defaultZoom={6}
                mapId="DEMO_MAP_ID"
                gestureHandling="greedy"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                className="w-full h-full"
              >
                {mappedPins.map((pin) => (
                  <AdvancedMarker
                    key={pin.key}
                    position={pin.position}
                    title={pin.key}
                    onClick={() => setSelectedPin(pin)}
                  >
                    <Pin background="#A6521C" borderColor="#FFFFFF" glyphColor="#FFFFFF" />
                  </AdvancedMarker>
                ))}

                {selectedPin && (
                  <InfoWindow position={selectedPin.position} onCloseClick={() => setSelectedPin(null)}>
                    <div className="p-1 min-w-[210px] text-left text-[#26231E]">
                      <p className="text-xs font-bold">{selectedPin.key}</p>
                      <p className="text-[11px] text-[#6B6459]">{selectedPin.n} listings</p>
                      <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-xs">
                        <span>Median asking:</span>
                        <strong>{selectedPin.askingGbp?.median != null ? formatGbp(selectedPin.askingGbp.median) : '–'}</strong>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Goodwill % of fees:</span>
                        <strong className="text-[#A6521C]">
                          {selectedPin.goodwillPctFees?.median != null ? `${Math.round(selectedPin.goodwillPctFees.median)}%` : '–'}
                        </strong>
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </APIProvider>
          </div>
        )}
      </div>

      {/* GOOGLE MAPS GROUNDING: LOCAL CATCHMENT & COMPETITOR INTELLIGENCE */}
      <div className="bg-white border rounded-[6px] p-6 sm:p-8 space-y-6" style={{ borderColor: 'var(--color-border)' }}>
        <div className="pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
            Maps-Grounded Local Catchment Intelligence
          </span>
          <h3 className="text-xl sm:text-2xl font-bold mt-2 text-[#26231E] flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
            <Compass className="w-5 h-5 text-[#A6521C]" />
            Assess Local Dental Competitors &amp; Buyer Demand
          </h3>
          <p className="text-xs sm:text-sm text-[#6B6459] mt-1">
            Query live Google Maps clinic data around any UK town or region to evaluate local competitor density, private vs NHS positioning, and corporate acquisition appeal.
          </p>
        </div>

        <form onSubmit={handleRunCatchmentAnalysis} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold uppercase text-[#6B6459] mb-1">
              UK Region
            </label>
            <select
              value={catchmentRegion}
              onChange={(e) => setCatchmentRegion(e.target.value)}
              className="w-full px-3 py-2.5 text-xs rounded-[4px] border bg-white text-[#26231E]"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {Object.keys(REGION_CENTROIDS).map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5">
            <label className="block text-[11px] font-bold uppercase text-[#6B6459] mb-1">
              Town or Outward Area (Optional)
            </label>
            <input
              type="text"
              value={customTown}
              onChange={(e) => setCustomTown(e.target.value)}
              placeholder="e.g., Leeds, Guildford, Bristol, Solihull"
              className="w-full px-3 py-2.5 text-xs rounded-[4px] border bg-white text-[#26231E]"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={loadingCatchment}
              className="btn-primary w-full !py-2.5 !px-4 text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              {loadingCatchment ? 'Scanning Catchment...' : 'Analyse Local Catchment'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-3.5 rounded-[6px] bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {catchmentMarkdown && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            <div className="lg:col-span-7 p-5 rounded-[6px] border bg-[#FAF8F4] text-sm text-[#26231E] whitespace-pre-wrap leading-relaxed" style={{ borderColor: 'var(--color-border)' }}>
              {catchmentMarkdown}
            </div>

            <div className="lg:col-span-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B6459]">
                Verified Google Maps Places &amp; Reviews ({groundedPlaces.length})
              </h4>
              {groundedPlaces.length === 0 ? (
                <p className="text-xs text-[#6B6459]">No specific place links returned for this query.</p>
              ) : (
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {groundedPlaces.map((place, idx) => (
                    <div
                      key={place.placeId || idx}
                      className="p-3.5 rounded-[6px] border bg-[#FAF8F4] space-y-1.5"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <a
                        href={place.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-[#A6521C] hover:underline flex items-center justify-between gap-2"
                      >
                        <span>{place.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                      </a>
                      {place.reviewSnippets.map((snip, sIdx) => (
                        <div key={sIdx} className="text-[11px] text-[#6B6459] italic">
                          {snip.text && <p>“{snip.text}”</p>}
                          {snip.uri && (
                            <a
                              href={snip.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#A6521C] underline not-italic"
                            >
                              View review on Google Maps
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
