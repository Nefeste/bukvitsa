// Корень: экраны переключаются состоянием, без роутера — их восемь и они простые (как в «Наготове»).
import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { FONT_FILES } from './src/ui/fonts';
import { useGame } from './src/state/game';
import { HomeScreen } from './src/screens/HomeScreen';
import { TaskScreen } from './src/screens/TaskScreen';
import { DayScreen } from './src/screens/DayScreen';
import { ArchiveScreen } from './src/screens/ArchiveScreen';
import { NotebooksScreen } from './src/screens/NotebooksScreen';
import { NotebookScreen } from './src/screens/NotebookScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { C } from './src/ui/theme';

export default function App() {
  const game = useGame();
  // шрифты студии лежат в сборке — грузятся мгновенно; не загрузились — игра идёт системным шрифтом
  const [fontsReady, fontsError] = useFonts(FONT_FILES);
  const { screen, setScreen } = game;
  // «Назад» на телефоне: из задачи — к её дню или тетради, отовсюду — на первый экран; с первого — выход
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen.name === 'home') return false;
      if (screen.name === 'task' && screen.flow.from === 'notebook') setScreen({ name: 'notebook', id: screen.flow.id });
      else if (screen.name === 'notebook') setScreen({ name: 'notebooks' });
      else setScreen({ name: 'home' });
      return true;
    });
    return () => sub.remove();
  }, [screen, setScreen]);
  const ready = (fontsReady || fontsError) && game.ready;
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <View style={styles.root}>
          {ready ? (
            <>
              {screen.name === 'home' ? <HomeScreen game={game} /> : null}
              {screen.name === 'task' ? <TaskScreen key={screen.id} game={game} flow={screen.flow} id={screen.id} /> : null}
              {screen.name === 'day' ? <DayScreen game={game} date={screen.date} /> : null}
              {screen.name === 'archive' ? <ArchiveScreen game={game} /> : null}
              {screen.name === 'notebooks' ? <NotebooksScreen game={game} /> : null}
              {screen.name === 'notebook' ? <NotebookScreen game={game} id={screen.id} /> : null}
              {screen.name === 'settings' ? <SettingsScreen game={game} /> : null}
              {screen.name === 'about' ? <AboutScreen game={game} /> : null}
            </>
          ) : null}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: C.linen } });
