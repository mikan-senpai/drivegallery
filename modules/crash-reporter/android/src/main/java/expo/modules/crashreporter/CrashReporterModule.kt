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
 *  - The app's own logcat (readable without permissions): the crash lines the
 *    system logged for the previous process (FATAL EXCEPTION / native backtrace).
 *  - Android 11+'s ApplicationExitInfo for the last abnormal exit, plus on 12+
 *    the readable strings of the native tombstone.
 */
class CrashReporterModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  // Resolved once while the context exists; the crash handler must not touch it.
  private var crashFile: File? = null

  override fun definition() = ModuleDefinition {
    Name("CrashReporter")

    OnCreate {
      crashFile = File(context.filesDir, "last-crash.txt")
      installHandler()
    }

    AsyncFunction("getLastCrash") {
      val exit = lastAbnormalExit() ?: return@AsyncFunction null
      val parts = mutableListOf(exit.summary)
      crashFile?.takeIf { it.exists() }?.let { parts.add(it.readText()) }
      crashLog()?.let { parts.add("Log:\n$it") }
      exit.tombstone?.let { parts.add("Tombstone:\n$it") }
      parts.joinToString("\n\n")
    }

    Function("clearLastCrash") {
      crashFile?.delete()
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        .putLong(KEY_SEEN_EXIT, System.currentTimeMillis()).apply()
    }
  }

  private fun installHandler() {
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    if (previous is RecordingHandler) return
    Thread.setDefaultUncaughtExceptionHandler(RecordingHandler(previous, crashFile))
  }

  private class Exit(val summary: String, val tombstone: String?)

  private fun lastAbnormalExit(): Exit? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      if (crashFile?.exists() != true) return null
      return Exit("Crash recorded", null)
    }
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
    val summary = "$reason at $time (pid ${info.pid})\n${info.description ?: ""}".trim()
    return Exit(summary, tombstoneStrings(info))
  }

  /** Native tombstones (Android 12+) are protobuf; the readable strings hold the signal, abort message and frames. */
  private fun tombstoneStrings(info: ApplicationExitInfo): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
    if (info.reason != ApplicationExitInfo.REASON_CRASH_NATIVE && info.reason != ApplicationExitInfo.REASON_ANR) return null
    return try {
      val bytes = info.traceInputStream?.use { it.readBytes() } ?: return null
      val out = StringBuilder()
      val cur = StringBuilder()
      for (b in bytes) {
        val c = b.toInt() and 0xff
        if (c in 0x20..0x7e) cur.append(c.toChar())
        else {
          if (cur.length >= 6) out.append(cur).append('\n')
          cur.setLength(0)
        }
        if (out.length > 6000) break
      }
      out.toString().ifBlank { null }
    } catch (_: Throwable) {
      null
    }
  }

  /** The app may read its own log entries, including the previous process's crash. */
  private fun crashLog(): String? = try {
    val proc = ProcessBuilder("logcat", "-d", "-b", "crash,main", "-v", "time", "-t", "3000")
      .redirectErrorStream(true).start()
    val lines = proc.inputStream.bufferedReader().use { it.readLines() }
    proc.waitFor()
    val start = lines.indexOfLast { it.contains("FATAL EXCEPTION") || it.contains("*** *** ***") || it.contains("Fatal signal") }
    if (start < 0) null
    else lines.drop(start)
      .filter { it.contains("AndroidRuntime") || it.contains("DEBUG") || it.contains("libc") || it.contains("CRASH") }
      .take(80)
      .joinToString("\n")
      .ifBlank { null }
  } catch (_: Throwable) {
    null
  }

  private class RecordingHandler(
    private val previous: Thread.UncaughtExceptionHandler?,
    private val file: File?
  ) : Thread.UncaughtExceptionHandler {
    override fun uncaughtException(thread: Thread, error: Throwable) {
      try {
        file?.writeText("Thread \"${thread.name}\":\n${Log.getStackTraceString(error)}".take(30000))
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
      ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE
    )
  }
}
