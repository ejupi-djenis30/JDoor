package com.jdoor.protocol;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.jdoor.security.SessionToken;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.security.SecureRandom;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;

class MessageCodecTest {
    private final MessageCodec codec = new MessageCodec();

    @ParameterizedTest
    @MethodSource("messages")
    void roundTripsEveryMessageType(WireMessage message) throws Exception {
        WireMessage decoded = roundTrip(message);

        if (message instanceof WireMessage.ScreenFrame expected) {
            WireMessage.ScreenFrame actual = assertInstanceOf(WireMessage.ScreenFrame.class, decoded);
            assertEquals(expected.sequence(), actual.sequence());
            assertEquals(expected.capturedAtEpochMillis(), actual.capturedAtEpochMillis());
            assertEquals(expected.width(), actual.width());
            assertEquals(expected.height(), actual.height());
            assertArrayEquals(expected.jpeg(), actual.jpeg());
        } else {
            assertEquals(message, decoded);
        }
    }

    @Test
    void rejectsUnknownMagicVersionAndType() throws Exception {
        assertThrows(ProtocolException.class, () -> codec.read(input(frame(0, MessageCodec.VERSION, 1, new byte[0]))));
        assertThrows(ProtocolException.class, () -> codec.read(input(frame(MessageCodec.MAGIC, 99, 1, new byte[0]))));
        assertThrows(
                ProtocolException.class,
                () -> codec.read(input(frame(MessageCodec.MAGIC, MessageCodec.VERSION, 255, new byte[0]))));
    }

    @Test
    void rejectsOversizedAndTruncatedPayloads() throws Exception {
        ByteArrayOutputStream oversized = new ByteArrayOutputStream();
        try (DataOutputStream output = new DataOutputStream(oversized)) {
            output.writeInt(MessageCodec.MAGIC);
            output.writeShort(MessageCodec.VERSION);
            output.writeByte(1);
            output.writeInt(MessageCodec.MAX_PAYLOAD_BYTES + 1);
        }
        assertThrows(ProtocolException.class, () -> codec.read(input(oversized.toByteArray())));

        ByteArrayOutputStream truncated = new ByteArrayOutputStream();
        try (DataOutputStream output = new DataOutputStream(truncated)) {
            output.writeInt(MessageCodec.MAGIC);
            output.writeShort(MessageCodec.VERSION);
            output.writeByte(1);
            output.writeInt(12);
            output.write(new byte[3]);
        }
        assertThrows(java.io.EOFException.class, () -> codec.read(input(truncated.toByteArray())));
    }

    @Test
    void rejectsTrailingPayloadData() throws Exception {
        byte[] valid = encode(new WireMessage.Ping(42));
        byte[] tampered = valid.clone();
        int payloadLengthOffset = 7;
        tampered[payloadLengthOffset + 3] = 9;
        byte[] withTrailing = java.util.Arrays.copyOf(tampered, tampered.length + 1);

        assertThrows(ProtocolException.class, () -> codec.read(input(withTrailing)));
    }

    @Test
    void defensiveCopiesScreenBytes() {
        byte[] bytes = {1, 2, 3};
        WireMessage.ScreenFrame frame = new WireMessage.ScreenFrame(1, 2, 10, 10, bytes);

        bytes[0] = 9;
        byte[] returned = frame.jpeg();
        returned[1] = 9;

        assertArrayEquals(new byte[] {1, 2, 3}, frame.jpeg());
    }

    @ParameterizedTest
    @CsvSource({
        "1, 7", "1, 8201", "2, 24", "2, 26", "3, 3", "3, 4101",
        "4, 28", "4, 6291485", "5, 9", "5, 11", "6, 8", "6, 10",
        "7, 0", "7, 2", "8, 7", "8, 9", "9, 7", "9, 9",
        "10, 3", "10, 4101", "11, 1"
    })
    void rejectsImpossibleTypeLengthsBeforeReadingPayload(int type, int declaredLength) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (DataOutputStream output = new DataOutputStream(bytes)) {
            output.writeInt(MessageCodec.MAGIC);
            output.writeShort(MessageCodec.VERSION);
            output.writeByte(type);
            output.writeInt(declaredLength);
        }
        // No body is supplied: trying to consume it would produce EOFException.
        assertThrows(ProtocolException.class, () -> codec.read(input(bytes.toByteArray())));
    }

    @ParameterizedTest
    @CsvSource({"2", "127", "255"})
    void rejectsNonCanonicalPermissionBooleans(int value) throws IOException {
        byte[] control = encode(new WireMessage.ControlState(false));
        control[control.length - 1] = (byte) value;
        assertThrows(ProtocolException.class, () -> codec.read(input(control)));

        byte[] hello = encode(new WireMessage.ServerHello(UUID.randomUUID(), 32, 24, false));
        hello[hello.length - 1] = (byte) value;
        assertThrows(ProtocolException.class, () -> codec.read(input(hello)));
    }

    private WireMessage roundTrip(WireMessage message) throws IOException {
        return codec.read(input(encode(message)));
    }

    private byte[] encode(WireMessage message) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        codec.write(new DataOutputStream(bytes), message);
        return bytes.toByteArray();
    }

    private static DataInputStream input(byte[] bytes) {
        return new DataInputStream(new ByteArrayInputStream(bytes));
    }

    private static byte[] frame(int magic, int version, int type, byte[] payload) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (DataOutputStream output = new DataOutputStream(bytes)) {
            output.writeInt(magic);
            output.writeShort(version);
            output.writeByte(type);
            output.writeInt(payload.length);
            output.write(payload);
        }
        return bytes.toByteArray();
    }

    private static Stream<WireMessage> messages() {
        String token = SessionToken.generate(new SecureRandom()).value();
        return Stream.of(
                new WireMessage.ClientHello(token, "Support laptop"),
                new WireMessage.ServerHello(UUID.randomUUID(), 1920, 1080, false),
                new WireMessage.ServerHello(UUID.randomUUID(), 1920, 1080, true),
                new WireMessage.Rejected("Not approved"),
                new WireMessage.ScreenFrame(5, 1_700_000_000_000L, 640, 480, new byte[] {1, 2, 3}),
                new WireMessage.PointerInput(WireMessage.PointerAction.MOVE, 0.25f, 0.75f, 0),
                new WireMessage.PointerInput(WireMessage.PointerAction.PRESS, 0.25f, 0.75f, 1),
                new WireMessage.KeyboardInput(WireMessage.KeyAction.PRESS, 65, 2),
                new WireMessage.ReleaseAllInputs(),
                new WireMessage.ControlState(true),
                new WireMessage.ControlState(false),
                new WireMessage.Ping(11),
                new WireMessage.Pong(12),
                new WireMessage.Goodbye("Done"));
    }
}
