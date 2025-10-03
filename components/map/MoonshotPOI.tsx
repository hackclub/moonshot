'use client';

import {Popup} from 'react-leaflet';
import Marker from '@/components/map/Marker';
import {latLng} from 'leaflet';
import {MapTheme} from '@/lib/map-theme';

const coordinates = latLng(28.52211882785977, -80.6815084134928);

export default function MoonshotPOI({theme}: { theme: MapTheme }) {
  return (
    <Marker iconConfig={theme.icons.shipwreckedPOI} iconState={{}} markerPosition={coordinates} zIndex={1000}>
      <Popup>
        <h2 className="text-lg font-semibold my-2">Kennedy Space Center</h2>
      </Popup>
    </Marker>
  );
}

