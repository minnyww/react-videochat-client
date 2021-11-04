import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled from "styled-components";
import Peer from "simple-peer";
import io from "socket.io-client";

const Video = styled.video`
  height: 20rem;
  margin: 2rem;
`;

const Container = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: start;
  align-items: center;
`;

const CallerContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const CallButton = styled.button`
  margin: 1rem;
  padding: 0.8rem;
  border-radius: 2rem;
  border-width: 0rem;
  &:hover {
    background-color: gray;
  }
  &:focus {
    outline: none;
  }
`;

const RecievingCallButton = styled.button`
  margin: 1rem;
  padding: 0.8rem;
  border-radius: 2rem;
  border-width: 0rem;
  color: white;
  background-color: darkolivegreen;
  &:hover {
    background-color: green;
  }
  &:focus {
    outline: none;
  }
`;

const VideoContainer = styled.div`
  display: flex;
  justify-content: space-between;
`;

const BlankContainer = styled.div`
  background-color: gray;
  height: 20rem;
  width: 28rem;
  margin: 2rem;
`;

function App() {
  const [stream, setStream] = useState();
  const [currentUserId, serCurrentUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [onlineUsersList, setOnlineUsersList] = useState({});
  const [receivingCall, setReceivingCall] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  // const [connectedPeer, setConnectedPeer] = useState();

  const [otherUserData, setOtherUserData] = useState(null);
  console.log("otherUserData :: ", otherUserData);

  const socket = useRef();
  const userVideoRef = useRef();
  const callerVideoRef = useRef();
  const connectionPeerRef = useRef();

  const PORT = "localhost:8000";

  const SOCKET_USER_ID = "user_id";
  const SOCKET_UPDATE_USER = "update_user";
  const SOCKET_ONLINE_USER = "online_user_list";
  const SOCKET_SOMEONE_CALLING = "someone_calling";
  const SOCKET_CALL_TO_SOME_ONE = "call_someone";
  const SOCKET_ACCEPTED_CALL = "call_accepted";
  const SOCKET_HANG_UP = "hang_up";
  const SOCKET_ANSWER_CALL = "answer_call";

  useEffect(() => {
    socket.current = io.connect(PORT);
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setStream(stream);
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
        }
      });
    socket.current.on(SOCKET_USER_ID, (id) => {
      serCurrentUserId(id);
    });
    socket.current.on(SOCKET_ONLINE_USER, (users) => {
      setOnlineUsersList(users);
    });
    socket.current.on(SOCKET_SOMEONE_CALLING, (data) => {
      setReceivingCall(true);
      setOtherUserData({
        id: data?.from,
        signal: data?.signal,
        name: data?.name,
      });
      // setOtherUserId(data.from);
      // setCallerSignal(data.signal);
    });
  }, []);

  function callPeer(id) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.current.emit(SOCKET_CALL_TO_SOME_ONE, {
        callId: id,
        data: data,
        callerId: currentUserId,
        name: userName,
      });
    });

    peer.on("stream", (stream) => {
      if (callerVideoRef.current) {
        callerVideoRef.current.srcObject = stream;
      }
    });

    socket.current.on(SOCKET_ACCEPTED_CALL, (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    socket.current.on(SOCKET_HANG_UP, () => {
      setCallAccepted(false);
      // setOtherUserId("");
      setOtherUserData(null);
    });

    connectionPeerRef.current = peer;
    // setConnectedPeer(peer);
  }

  const answerCall = useCallback(() => {
    setCallAccepted(true);
    setReceivingCall(false);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    });
    peer.on("signal", (data) => {
      socket.current.emit(SOCKET_ANSWER_CALL, {
        signal: data,
        to: otherUserData?.id,
      });
    });

    peer.on("stream", (stream) => {
      callerVideoRef.current.srcObject = stream;
    });

    peer.signal(otherUserData?.signal);

    connectionPeerRef.current = peer;
    // setConnectedPeer(peer);
  }, [stream, otherUserData?.signal, otherUserData?.id]);

  function hangUp() {
    setReceivingCall(false);
    setOtherUserData(null);
    // setOtherUserId("");
    // setCallerSignal(null);
    setCallAccepted(false);
    connectionPeerRef.current.destroy();
    connectionPeerRef.current = null;
    //   setConnectedPeer(null);
  }

  const userVideoComponent = useMemo(() => {
    if (stream) {
      return <Video playsInline ref={userVideoRef} autoPlay />;
    }
  }, [stream]);

  const incomingCall = useMemo(() => {
    if (receivingCall) {
      return (
        <>
          <p>{otherUserData?.name} is calling you</p>
          <RecievingCallButton onClick={() => answerCall()}>
            Accept
          </RecievingCallButton>
        </>
      );
    }
  }, [answerCall, otherUserData, receivingCall]);

  const partnerVideoComponent = useMemo(() => {
    if (callAccepted) {
      return <Video playsInline ref={callerVideoRef} autoPlay />;
    }
  }, [callAccepted]);

  return (
    <Container>
      <h1>Video Chat!</h1>
      <input
        placeholder="enter your name"
        onChange={({ target: { value } }) => {
          setUserName(value);
          socket.current.emit(SOCKET_UPDATE_USER, {
            id: currentUserId,
            name: userName,
          });
        }}
      />
      <VideoContainer>
        {userVideoComponent}
        {partnerVideoComponent ? partnerVideoComponent : <BlankContainer />}
      </VideoContainer>

      <CallerContainer>
        <h2>Online User</h2>
        {Object.values(onlineUsersList).map((user) => {
          console.log("user : ", user);
          if (user?.id !== currentUserId) {
            return (
              <CallButton
                key={user?.id}
                onClick={() => callPeer(user.id)}
              >{`Call ${user?.name ?? user?.id}`}</CallButton>
            );
          } else {
            return "";
          }
        })}
      </CallerContainer>
      {incomingCall}
      {otherUserData && <CallButton onClick={hangUp}>{`Hangup`}</CallButton>}
    </Container>
  );
}

export default App;
