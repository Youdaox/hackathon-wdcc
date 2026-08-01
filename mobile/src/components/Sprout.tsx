import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

type SproutProps = {
  size?: number;
  stage?: 1 | 2 | 3;
  flower?: boolean;
  happy?: boolean;
  bubbles?: boolean;
};

/** A code-drawn companion so the character stays crisp at every screen size. */
export function Sprout({
  size = 124,
  stage = 3,
  flower = false,
  happy = false,
  bubbles = false,
}: SproutProps) {
  const bodyColor = stage === 1 ? colors.accentPale : stage === 2 ? colors.accentSoft : "#7fc08e";
  const eye = Math.max(5, size * 0.085);

  return (
    <View style={[styles.frame, { width: size * 1.32, height: size * 1.2 }]}>
      {bubbles && (
        <>
          <View style={[styles.bubble, { width: size * 0.12, height: size * 0.12, right: 2, top: size * 0.04 }]} />
          <View style={[styles.bubble, styles.bubbleSmall, { width: size * 0.075, height: size * 0.075, right: -size * 0.07, top: size * 0.2 }]} />
        </>
      )}

      <View
        style={[
          styles.body,
          {
            width: size,
            height: size,
            borderRadius: size * 0.48,
            backgroundColor: bodyColor,
            bottom: 0,
          },
        ]}
      >
        <View
          style={[
            styles.eye,
            { width: eye, height: eye, borderRadius: eye / 2, left: size * 0.36, top: size * 0.43 },
          ]}
        />
        <View
          style={[
            styles.eye,
            { width: eye, height: eye, borderRadius: eye / 2, right: size * 0.28, top: size * 0.43 },
          ]}
        />
        {happy ? (
          <View
            style={[
              styles.happyMouth,
              {
                width: size * 0.2,
                height: size * 0.12,
                borderBottomLeftRadius: size * 0.12,
                borderBottomRightRadius: size * 0.12,
                top: size * 0.6,
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.smallMouth,
              {
                width: size * 0.11,
                height: size * 0.055,
                borderRadius: size * 0.04,
                top: size * 0.6,
              },
            ]}
          />
        )}
      </View>

      <View
        style={[
          styles.leaf,
          {
            width: size * 0.34,
            height: size * 0.27,
            borderTopRightRadius: size * 0.25,
            borderBottomLeftRadius: size * 0.25,
            left: size * 0.48,
            top: size * 0.03,
          },
        ]}
      />

      {flower && (
        <View style={[styles.flower, { left: size * 0.58, top: -size * 0.06 }]}>
          <View style={[styles.petal, { top: 0, left: size * 0.055 }]} />
          <View style={[styles.petal, { top: size * 0.05, left: 0 }]} />
          <View style={[styles.petal, { top: size * 0.05, right: 0 }]} />
          <View style={[styles.petal, { bottom: 0, left: size * 0.055 }]} />
          <View style={styles.flowerCenter} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: "relative", alignItems: "center", justifyContent: "flex-end" },
  body: { position: "absolute", overflow: "hidden" },
  leaf: { position: "absolute", backgroundColor: "#56ad70", transform: [{ rotate: "-10deg" }] },
  eye: { position: "absolute", backgroundColor: colors.text },
  happyMouth: { position: "absolute", alignSelf: "center", backgroundColor: colors.text },
  smallMouth: { position: "absolute", alignSelf: "center", backgroundColor: colors.text },
  bubble: { position: "absolute", borderRadius: 999, backgroundColor: "#f8dcc9" },
  bubbleSmall: { backgroundColor: colors.peach },
  flower: { position: "absolute", width: 18, height: 18 },
  petal: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: "#f29a75" },
  flowerCenter: { position: "absolute", left: 6, top: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: "#f8d4aa" },
});
