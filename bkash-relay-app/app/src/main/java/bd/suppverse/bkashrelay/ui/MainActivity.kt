package bd.suppverse.bkashrelay.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import bd.suppverse.bkashrelay.data.AppDatabase
import bd.suppverse.bkashrelay.data.QueuedTransaction
import bd.suppverse.bkashrelay.data.RelaySettings
import bd.suppverse.bkashrelay.data.UploadStatus
import bd.suppverse.bkashrelay.databinding.ActivityMainBinding
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var settings: RelaySettings

    private val requiredPermissions = arrayOf(
        Manifest.permission.RECEIVE_SMS,
        Manifest.permission.READ_SMS,
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        settings = RelaySettings(this)
        binding.relayUrlInput.setText(settings.relayUrl ?: "")
        binding.relayTokenInput.setText(settings.relayToken ?: "")

        binding.saveSettingsButton.setOnClickListener {
            settings.relayUrl = binding.relayUrlInput.text.toString().trim()
            settings.relayToken = binding.relayTokenInput.text.toString().trim()
            binding.settingsStatus.text = "Saved."
        }

        binding.requestPermissionsButton.setOnClickListener { requestSmsPermissions() }
        binding.requestBatteryExemptButton.setOnClickListener { requestBatteryExemption() }

        requestSmsPermissions()
        updatePermissionStatus()

        observeQueue()
    }

    override fun onResume() {
        super.onResume()
        updatePermissionStatus()
    }

    private fun requestSmsPermissions() {
        val missing = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), 1001)
        }
    }

    private fun updatePermissionStatus() {
        val granted = requiredPermissions.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
        binding.permissionStatus.text = if (granted) "SMS permissions: granted" else "SMS permissions: NOT granted — tap to fix"

        val pm = getSystemService(POWER_SERVICE) as PowerManager
        val ignoring = pm.isIgnoringBatteryOptimizations(packageName)
        binding.batteryStatus.text = if (ignoring) "Battery optimization: exempted" else "Battery optimization: NOT exempted — tap to fix"
    }

    @Suppress("BatteryLife")
    private fun requestBatteryExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                startActivity(
                    Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:$packageName"),
                    )
                )
            }
        }
    }

    private fun observeQueue() {
        val dao = AppDatabase.get(this).queueDao()
        lifecycleScope.launch {
            dao.recent(20).collectLatest { items -> renderLog(items) }
        }
    }

    private fun renderLog(items: List<QueuedTransaction>) {
        binding.logContainer.removeAllViews()
        val fmt = SimpleDateFormat("MMM d, HH:mm:ss", Locale.US)

        if (items.isEmpty()) {
            binding.logContainer.addView(TextView(this).apply { text = "No SMS seen yet." })
            return
        }

        for (item in items) {
            val statusLabel = when (item.status) {
                UploadStatus.PENDING -> "⏳ pending"
                UploadStatus.UPLOADED -> "✅ uploaded"
                UploadStatus.FAILED_UNPARSEABLE -> "⚠️ ${item.lastError ?: "failed"}"
            }
            val summary = if (item.transactionId != null) {
                "TrxID ${item.transactionId} · ৳${item.amount} · from ${item.sender}"
            } else {
                "Unparsed SMS (forwarded raw for manual review)"
            }
            val line = "${fmt.format(Date(item.receivedAtEpochMs))}\n$summary\n$statusLabel\n"
            binding.logContainer.addView(TextView(this).apply { text = line })
        }
    }
}
