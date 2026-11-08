// Корень: экраны переключаются состоянием, без роутера (ADR 0004).
import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { FONT_FILES } from './src/ui/fonts';
import { useGame } from './src/state/game';
import { HomeScreen } from './src/screens/HomeScreen';
import { TaskScreen } from './src/screens/TaskScreen';
import { ArchiveScreen } from './src/screens/ArchiveScreen';
import { NotebookScreen } from './src/screens/NotebookScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { PlusScreen } from './src/screens/PlusScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { AdScreen } from './src/screens/AdScreen';
import { ReportScreen } from './src/screens/ReportScreen';
import { installCrashHandlers } from './src/state/crashlog';
import { useLook } from './src/ui/theme';

// журнал сбоев для «Сообщить об ошибке» — с первой строчки, до первого экрана
installCrashHandlers();

export default function App() {
  const game = useGame();
  // шрифты студии лежат в сборке — грузятся мгновенно; не загрузились — игра идёт системным шрифтом
  const [fontsReady, fontsError] = useFonts(FONT_FILES);
  const { screen, setScreen } = game;
  // «Назад» на телефоне: из отчёта — туда, откуда открыт; из задачи тетради — к тетради, отовсюду — на главную; с главной — выход
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen.name === 'home') return false;
      if (screen.name === 'report') setScreen(screen.back);
      else if (screen.name === 'task' && screen.flow.from === 'notebook') setScreen({ name: 'notebook', key: screen.flow.key });
      else setScreen({ name: 'home' });
      return true;
    });
    return () => sub.remove();
  }, [screen, setScreen]);
  const ready = (fontsReady || fontsError) && game.ready;
  const { c } = useLook();
  const root = [styles.root, { backgroundColor: c.linen }];
  return (
    <SafeAreaProvider>
      <SafeAreaView style={root}>
        <StatusBar style={c.dark ? 'light' : 'dark'} />
        <View style={root}>
          {ready ? (
            <>
              {screen.name === 'home' ? <HomeScreen game={game} /> : null}
              {screen.name === 'task' ? <TaskScreen key={screen.id} game={game} flow={screen.flow} id={screen.id} /> : null}
              {screen.name === 'archive' ? <ArchiveScreen game={game} /> : null}
              {screen.name === 'notebook' ? <NotebookScreen game={game} book={screen.key} /> : null}
              {screen.name === 'settings' ? <SettingsScreen game={game} /> : null}
              {screen.name === 'about' ? <AboutScreen game={game} /> : null}
              {screen.name === 'plus' ? <PlusScreen game={game} /> : null}
              {screen.name === 'consent' ? <ConsentScreen game={game} next={screen.next} /> : null}
              {screen.name === 'ad' ? <AdScreen game={game} next={screen.next} /> : null}
              {screen.name === 'report' ? <ReportScreen game={game} task={screen.task} screen={screen.screen} back={screen.back} /> : null}
            </>
          ) : null}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
