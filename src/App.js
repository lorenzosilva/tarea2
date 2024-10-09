import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import departure from './iconos/departure.png'
import destination from './iconos/destino.png'
import plane from './iconos/avion.png'
import crash from './iconos/accidente.png'



const iconoSalida = new L.Icon({
  iconUrl: departure,
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [1, -30]
});

const iconoDestino = new L.Icon({
  iconUrl: destination,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -30]
});

const iconoAvion = new L.Icon({
  iconUrl: plane,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15]
});

const iconoAccidente = new L.Icon({
  iconUrl: crash,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
});






const App = () => {
  const [vuelos, setVuelos] = useState([]);
  const [aviones, setAviones] = useState([]);
  let avionesGlobal = [];
  const [avionesAccidentados, setAvionesAccidentados] = useState([]);
  const [rutasAviones, setRutasAviones] = useState({});
  const [aterrizajes, setAterrizajes]= useState([]);
  const [despegues, setDespegues] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] =useState('');
  const contenedorMensajesRef = useRef(null);
  const [vuelosFinalizados, setVuelosFinalizados] = useState([]);
  const socketRef=useRef(null);



  const urlServidor = 'wss://tarea-2.2024-2.tallerdeintegracion.cl/connect';

  const intervalo = 1000;

  const conectarWebSocket = useCallback(() => {
    const socket = new WebSocket(urlServidor);
    socketRef.current = socket;

    socket.onopen = () => {
      const join = {
        type: 'join',
        id: '17625319',
      };
      socket.send(JSON.stringify(join));
    };

    socket.onmessage = (evento) => {
      const data = JSON.parse(evento.data);
    



      switch (data.type) {
        case 'flights':
          const idVuelosActivos = new Set(Object.keys(data.flights));
          const vuelosActivos = Object.values(data.flights);

          setAviones(prevAviones => prevAviones.filter(avion => idVuelosActivos.has(avion.flight_id)));
          setRutasAviones(rutasPrevias => {

            const rutasFiltradas = {};
            Object.keys(rutasPrevias).forEach(flight_id => {
              if (idVuelosActivos.has(flight_id)) {
                rutasFiltradas[flight_id] = rutasPrevias[flight_id];

              }
            });


            return rutasFiltradas;
          });

          setVuelos(vuelosActivos);

          setAterrizajes(anterior => anterior.filter(flightId => idVuelosActivos.has(flightId)));
          break;
    



        case 'plane':
          const avion = data.plane;

          setAviones(prevAviones => {

            const avionesActualizados = prevAviones.filter(a => a.flight_id!==avion.flight_id);
            const nuevosAviones = [...avionesActualizados, avion];
            avionesGlobal = nuevosAviones;

            return nuevosAviones;
          });

          setRutasAviones(rutasPrevias => ({

            ...rutasPrevias,
            [avion.flight_id]: rutasPrevias[avion.flight_id] ? [...rutasPrevias[avion.flight_id], avion.position] : [avion.position]

          }));
          break;




        case 'crashed':
          try {

            const avionAccidentado = avionesGlobal.find(avion => avion.flight_id === data.flight_id);
            if (avionAccidentado) {

              setAvionesAccidentados(anterior => [
                ...anterior,
                { flight_id: data.flight_id, position: avionAccidentado.position }
              ]);

              avionesGlobal = avionesGlobal.filter(a => a.flight_id !== data.flight_id);
              setAviones(prevAviones=> prevAviones.filter(a => a.flight_id !== data.flight_id));

              setTimeout(() => {

                setAvionesAccidentados(anterior => anterior.filter(a => a.flight_id !== data.flight_id));
              }, 60000);
            }
          } 
          catch (error) {
            console.error("error");
          }
          break;
    




        case 'message':
          setMensajes(anterior => [...anterior, data.message]);

          break;
    





        case 'landing':
          setAterrizajes(anterior => [...anterior, data.flight_id]);
    
          const vueloFinalizado = vuelos.find(vuelo => vuelo.id === data.flight_id);
          if (vueloFinalizado) {

            setVuelosFinalizados(anterior => [...anterior, vueloFinalizado]);
            setVuelos(anterior => anterior.filter(vuelo => vuelo.id !== data.flight_id));

          }
    
          setTimeout(() => {

            setAterrizajes(anterior => anterior.filter(id => id !== data.flight_id));
          }, 60000);

          break;
    





        case 'take-off':
          setDespegues(anterior => [...anterior, data.flight_id]);

          setTimeout(() => {

            setDespegues(anterior => anterior.filter(id => id !== data.flight_id));
          }, 60000);
          break;

          
        default:
          break;

      }
    };


    

    socket.onclose = () => {

        setTimeout(() => {
          conectarWebSocket();
        }, intervalo);
        
      
    };

  }, [urlServidor]);



  useEffect(() => {
    conectarWebSocket();
    return () => {

      if (socketRef.current) socketRef.current.close();
    };

  }, [conectarWebSocket]);




  const dividirRutaCorta = (inicio, final) => {
    const [latitud1, longitud1] = inicio;
    const [latitud2, longitud2] = final;


    if (Math.abs(longitud1 - longitud2) > 180) {

      const latitudMedia = (latitud1 + latitud2) / 2;
      const linea1 = [

        [latitud1, longitud1],
        [latitudMedia, longitud1 > 0 ? 180 : -180]

      ];


      const linea2 = [

        [latitudMedia, longitud1 > 0 ? -180 : 180],
        [latitud2, longitud2]

      ];

      return [linea1, linea2];
    }


    return [[[latitud1, longitud1], [latitud2, longitud2]]];
  };






  const enviarMensaje = () => {

    if (nuevoMensaje.trim() !== '' && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {

      const chat = {
        type: 'chat',
        content: nuevoMensaje.trim(),

      };


      socketRef.current.send(JSON.stringify(chat));
      setNuevoMensaje('');
    }
  };

  

  const escribir = (e) => {
    if (e.key === 'Enter') {
      enviarMensaje();
    }
  };



  const bajarScroll = () => {

    if (contenedorMensajesRef.current) {
      contenedorMensajesRef.current.scrollTop = contenedorMensajesRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    bajarScroll();
  }, [mensajes]);

  







  return (

    <div className="container">

      <div className="mapa_chat">
        <div className="mapa">

          <MapContainer
            center={[48, 0]}
            zoom={2}
            minZoom={2}
            style={{ width: '100%', height: '100%' }}
            maxBounds={[[-85, -180], [85, 180]]}
            maxBoundsViscosity={1.0}
            scrollWheelZoom={true}>

            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>


            {vuelos.map(vuelo => {
              
              const segmentos = dividirRutaCorta(
                [vuelo.departure.location.lat, vuelo.departure.location.long],
                [vuelo.destination.location.lat, vuelo.destination.location.long]
              );

              return (
                <React.Fragment key={vuelo.id}>
                  <Marker
                    position={[vuelo.departure.location.lat, vuelo.departure.location.long]}
                    icon={iconoSalida}>

                    <Popup>
                      <strong>{vuelo.departure.name}</strong><br />
                      Ciudad: {vuelo.departure.city.name}, {vuelo.departure.city.country.name}<br />
                      ID vuelo: {vuelo.id}
                    </Popup>

                  </Marker>


                  <Marker
                    position={[vuelo.destination.location.lat, vuelo.destination.location.long]}
                    icon={iconoDestino}>

                    <Popup>
                      <strong>{vuelo.destination.name}</strong><br />
                      Ciudad: {vuelo.destination.city.name}, {vuelo.destination.city.country.name}<br />
                      ID vuelo: {vuelo.id}
                    </Popup>

                  </Marker>



                  {segmentos.map((segmento, indice) => (
                    <Polyline
                      key={`${vuelo.id}-${indice}`}
                      positions={segmento}
                      color="blue"
                      weight={2}/>
                  ))
                  }

                </React.Fragment>
              );
            })
            }



            {aviones.map(avion => (

              <React.Fragment key={avion.flight_id}>
                <Marker
                  position={[avion.position.lat, avion.position.long]}
                  icon={iconoAvion}
>
                  <Popup>
                    vuelo ID: {avion.flight_id}<br />
                    aerolinea: {avion.airline.name}<br />
                    capitan: {avion.captain}<br />
                    llegada: {avion.ETA.toFixed(2)} horas<br/>
                    estado: {avion.status}
                  </Popup>

                </Marker>

                {rutasAviones[avion.flight_id] && (
                  rutasAviones[avion.flight_id].map((pos, idx) => (
                    <CircleMarker
                      key={`${avion.flight_id}-${idx}`}
                      center={[pos.lat, pos.long]}
                      radius={2}
                      color="red"/>
                  ))
                )}

              </React.Fragment>
            ))}



            {avionesAccidentados.map(avionAccidentado => (
              <Marker
                key={avionAccidentado.flight_id}
                position={[avionAccidentado.position.lat, avionAccidentado.position.long]}
                icon={iconoAccidente}>

                <Popup>
                  Vuelo: {avionAccidentado.flight_id}<br />
                  el avion sufrio un accidente
                </Popup>

              </Marker>
            ))}




            {despegues.map(flightId => {
              const avion=aviones.find(a => a.flight_id===flightId);

              if (avion && avion.position) {

                return (

                  <CircleMarker
                    key={flightId}
                    center={[avion.position.lat, avion.position.long]}
                    radius={10}
                    color="green">

                  </CircleMarker>
                );
              }

              return null;
            })}



            {aterrizajes.map(flightId => (

              <CircleMarker
                key={flightId}
                center={[aviones.find(avion =>avion.flight_id===flightId)?.position.lat, aviones.find(avion=>avion.flight_id===flightId)?.position.long]}
                radius={10}
                color="blue">

              </CircleMarker>
            ))}

          </MapContainer>
        </div>



        <div className="chatContainer">
          <h2>Chat</h2>
          <div className="listaMensajes" ref={contenedorMensajesRef} style={{ maxHeight: '400px', overflowY: 'auto' }}>

            {mensajes.map((mensaje, indice) => (

              <div key={indice} className={`message ${mensaje.level === 'warn' ? 'warn' : ''}`}>

                <strong>{mensaje.name}:</strong> {mensaje.content}<br />
                <small>{new Date(mensaje.date).toLocaleString()}</small>

              </div>
            ))}

          </div>


          <div className="entrada">
            <input
              type="text"
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              onKeyPress={escribir}
              placeholder="Escribe un mensaje..." />
            <button onClick={enviarMensaje}>Enviar</button>

          </div>
        </div>
      </div>




      <div className="tabla">
        <h2>Tabla Informativa</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Aeropuerto de Salida</th>
              <th>Aeropuerto de Destino</th>
              <th>Fecha de Salida</th>
            </tr>
          </thead>

          <tbody>
            {vuelos.map(vuelo => (
              <tr key={vuelo.id}>
                <td>{vuelo.id}</td>
                <td>{vuelo.departure.name} ({vuelo.departure.city.name}, {vuelo.departure.city.country.name})</td>
                <td>{vuelo.destination.name} ({vuelo.destination.city.name}, {vuelo.destination.city.country.name})</td>
                <td>{new Date(vuelo.departure_date).toLocaleString()}</td>
              </tr>

            ))}



            {vuelosFinalizados.map(vuelo => (

              <tr key={vuelo.id}>
                <td>{vuelo.id}</td>
                <td>{vuelo.departure.name} ({vuelo.departure.city.name}, {vuelo.departure.city.country.name})</td>
                <td>{vuelo.destination.name} ({vuelo.destination.city.name}, {vuelo.destination.city.country.name})</td>
                <td>{new Date(vuelo.departure_date).toLocaleString()}</td>
              </tr>

            ))}

          </tbody>
        </table>
      </div>
    </div>
    
  );
};

export default App;
