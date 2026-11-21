package expo.modules.crashreporter

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Records why the app last died, so the user can see (and screenshot) it on the
 * next launch — no adb or developer options needed.
 *
 *  - Java/Kotlin crashes: a default uncaught-exception handler writes the stack
 *    trace to files/last-crash.txt, then hands off to the previous handler.
 *  - Everything else (native C++ crashes, OOM kills, ANRs): Android 11+'s
 *    ApplicationExitInfo for the last process exit.
 */
class CrashReporterModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  private val crashFile: File
    get() = File(context.filesDir, "last-crash.txt")

  override fun definition() = ModuleDefinition {
    Name("CrashReporter")

    OnCreate {
      installHandler()
    }

    AsyncFunction("getLastCrash") {
      val parts = mutableListOf<String>()
      if (crashFile.exists()) parts.add(crashFile.readText())
      lastAbnormalExit()?.let { parts.add(it) }
      if (parts.isEmpty()) null else parts.joinToString("\n\n")
    }

    Function("clearLastCrash") {
      crashFile.delete()
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        .putLong(KEY_SEEN_EXIT, System.currentTimeMillis()).apply()
    }
  }

  private fun installHandler() {
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    if (previous is RecordingHandler) return
    Thread.setDefaultUncaughtExceptionHandler(RecordingHandler(previous))
  }

  private fun lastAbnormalExit(): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
    val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val seenBefore = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_SEEN_EXIT, 0L)
    val info = am.getHistoricalProcessExitReasons(context.packageName, 0, 5)
      .firstOrNull { it.timestamp > seenBefore && it.reason in ABNORMAL } ?: return null
    val reason = when (info.reason) {
      ApplicationExitInfo.REASON_CRASH -> "Java crash"
      ApplicationExitInfo.REASON_CRASH_NATIVE -> "Native crash"
      ApplicationExitInfo.REASON_ANR -> "App not responding"
      ApplicationExitInfo.REASON_LOW_MEMORY -> "Killed: low memory"
      ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "Killed: excessive resource use"
      else -> "Exit reason ${info.reason}"
    }
    val time = SimpleDateFormat("d MMM HH:mm:ss", Locale.US).format(Date(info.timestamp))
    val memMb = info.pss / 1024
    return "System record: $reason at $time\n${info.description ?: "(no description)"}\nMemory at exit: ${memMb} MB"
  }

  private inner class RecordingHandler(
    private val previous: Thread.UncaughtExceptionHandler?
  ) : Thread.UncaughtExceptionHandler {
    override fun uncaughtException(thread: Thread, error: Throwable) {
      try {
        crashFile.writeText("Crash on thread \"${thread.name}\":\n${Log.getStackTraceString(error)}".take(30000))
      } catch (_: Throwable) {
        // Never let reporting interfere with the crash itself.
      }
      previous?.uncaughtException(thread, error)
    }
  }

  companion object {
    private const val PREFS = "crash-reporter"
    private const val KEY_SEEN_EXIT = "seen-exit"
    private val ABNORMAL = setOf(
      ApplicationExitInfo.REASON_CRASH,
      ApplicationExitInfo.REASON_CRASH_NATIVE,
      ApplicationExitInfo.REASON_ANR,
      ApplicationExitInfo.REASON_LOW_MEMORY,
      ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE
    )
  }
}
