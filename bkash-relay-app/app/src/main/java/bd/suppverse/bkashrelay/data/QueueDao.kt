package bd.suppverse.bkashrelay.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface QueueDao {

    @Insert
    suspend fun insert(item: QueuedTransaction): Long

    @Query("SELECT * FROM queued_transactions WHERE status = 'PENDING' ORDER BY receivedAtEpochMs ASC")
    suspend fun getPending(): List<QueuedTransaction>

    @Query("SELECT * FROM queued_transactions ORDER BY receivedAtEpochMs DESC LIMIT :limit")
    fun recent(limit: Int = 20): Flow<List<QueuedTransaction>>

    @Query("UPDATE queued_transactions SET status = :status, uploadedAtEpochMs = :uploadedAt, lastError = :error WHERE id = :id")
    suspend fun markResult(id: Long, status: UploadStatus, uploadedAt: Long?, error: String?)
}
