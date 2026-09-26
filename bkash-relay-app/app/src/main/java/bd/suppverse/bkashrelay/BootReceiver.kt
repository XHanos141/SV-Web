package bd.suppverse.bkashrelay

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import bd.suppverse.bkashrelay.data.AppDatabase
import bd.suppverse.bkashrelay.work.UploadWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * WorkManager persists and reschedules its own enqueued work across reboots
 * automatically — this receiver is just a defensive double-check that
 * re-enqueues anything still sitting PENDING in Room, in case a row was
 * inserted but the enqueue step itself never completed (e.g. app was killed
 * between the two steps).
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val dao = AppDatabase.get(context).queueDao()
                val wm = WorkManager.getInstance(context)
                dao.getPending().forEach { item ->
                    val work = OneTimeWorkRequestBuilder<UploadWorker>()
                        .setInputData(UploadWorker.inputFor(item.id))
                        .build()
                    wm.enqueueUniqueWork("upload_${item.id}", ExistingWorkPolicy.KEEP, work)
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
