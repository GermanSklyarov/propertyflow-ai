import { Bot, Building2, Camera, ChevronDown, CircleDollarSign, FileScan, Plus } from "lucide-react";
import { createPropertyAction } from "@entities/listing/api/listing-actions";
import styles from "./create-listing-form.module.css";

const markets = [
  { label: "Pattaya", value: "pattaya" },
  { label: "Phuket", value: "phuket" },
  { label: "Bangkok", value: "bangkok" },
  { label: "Hua Hin", value: "hua-hin" },
  { label: "Koh Samui", value: "koh-samui" }
];

const propertyKinds = [
  { label: "Condo", value: "condo" },
  { label: "Villa", value: "villa" },
  { label: "Townhouse", value: "townhouse" },
  { label: "Land", value: "land" },
  { label: "Commercial", value: "commercial" }
];

const listingTypes = [
  { label: "Sale", value: "sale" },
  { label: "Rent", value: "rent" },
  { label: "Sale or rent", value: "sale_or_rent" }
];

const projectStatuses = [
  { label: "Completed", value: "completed" },
  { label: "Under construction", value: "under_construction" },
  { label: "Planned", value: "planned" },
  { label: "Paused", value: "paused" }
];

export function CreateListingForm() {
  return (
    <section className={styles.panel} id="create-listing">
      <details className={styles.drawer}>
        <summary className={styles.openButton}>
          <span>
            <Plus size={18} />
            Add listing
          </span>
          <small>Start with essentials and photos. Let AI fill the rest.</small>
          <ChevronDown size={18} />
        </summary>

        <div className={styles.body}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">AI-assisted intake</p>
              <h2 className={styles.panelTitle}>Create a listing draft</h2>
              <p className={styles.hint}>
                Add only the facts an agent usually has first. Photos can go straight into AI image analysis; pricing, copy,
                amenities, and positioning can be refined from the listing page.
              </p>
            </div>
            <Building2 size={21} />
          </div>

          <form action={createPropertyAction} className={styles.form}>
            <section className={styles.step}>
              <div className={styles.stepHeader}>
                <span>1</span>
                <div>
                  <h3>Listing source</h3>
                  <p>Start from a Chanote document or fill the same facts manually.</p>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <label className={styles.wideField}>
                  <span>Working title or address</span>
                  <input name="title" placeholder="Wongamat condo near beach" required />
                </label>
                <label className={styles.field}>
                  <span>Market</span>
                  <select defaultValue="pattaya" name="market" required>
                    {markets.map((market) => (
                      <option key={market.value} value={market.value}>
                        {market.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Intent</span>
                  <select defaultValue="sale_or_rent" name="listingType" required>
                    {listingTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Kind</span>
                  <select defaultValue="condo" name="kind" required>
                    {propertyKinds.map((kind) => (
                      <option key={kind.value} value={kind.value}>
                        {kind.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.subSection}>
                <div className={styles.sectionTitle}>
                  <FileScan size={16} />
                  Chanote-assisted fields
                </div>

                <div className={styles.chanoteGrid}>
                  <label className={styles.fileDrop}>
                    <FileScan size={19} />
                    <span>Upload Chanote</span>
                    <small>PDF, image, or text file. Text files can be parsed immediately; images/PDFs are kept as OCR-ready context.</small>
                    <input accept="image/*,.pdf,.txt,text/plain" name="chanoteFile" type="file" />
                  </label>
                  <label className={styles.wideField}>
                    <span>OCR text or agent transcription</span>
                    <textarea
                      name="chanoteText"
                      placeholder="Owner: ...&#10;Address: ...&#10;Area: 45 sqm"
                    />
                  </label>
                </div>

                <div className={styles.manualFallbackGrid}>
                  <label className={styles.field}>
                    <span>Area sqm</span>
                    <input min={1} name="areaSqm" placeholder="45 or extracted from Chanote" step="0.1" type="number" />
                  </label>
                  <label className={styles.wideField}>
                    <span>Address or landmark</span>
                    <input name="address" placeholder="Leave blank if Chanote OCR contains the address" />
                  </label>
                </div>

                <div className={styles.aiNote}>
                  <Bot size={16} />
                  <span>Extracted address and area fill blank fields. Owner details stay in the agent note until reviewed.</span>
                </div>
              </div>

              <div className={styles.subSection}>
                <div className={styles.sectionTitle}>
                  <Building2 size={16} />
                  Development project
                </div>

                <div className={styles.fieldGrid}>
                  <label className={styles.wideField}>
                    <span>Project / development name</span>
                    <input name="projectName" placeholder="The Riviera Wongamat, Laguna Phuket, etc." />
                  </label>
                  <label className={styles.field}>
                    <span>Project status</span>
                    <select defaultValue="completed" name="projectStatus">
                      {projectStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Developer</span>
                    <input name="projectDeveloper" placeholder="Developer name" />
                  </label>
                </div>

                <div className={styles.aiNote}>
                  <Bot size={16} />
                  <span>Listings can share project-level developer, construction status, location, and amenities.</span>
                </div>
              </div>
            </section>

            <section className={styles.step}>
              <div className={styles.stepHeader}>
                <span>2</span>
                <div>
                  <h3>Photos for AI</h3>
                  <p>Upload first photos now; AI analysis can detect amenities and presentation signals.</p>
                </div>
              </div>

              <label className={styles.fileDrop}>
                <Camera size={19} />
                <span>Upload photos</span>
                <small>Multiple images supported. They will be attached after the draft is created.</small>
                <input accept="image/*" multiple name="imageFiles" type="file" />
              </label>

              <label className={styles.checkbox}>
                <input defaultChecked name="analyzeImages" type="checkbox" />
                <span>Queue AI image analysis</span>
              </label>
            </section>

            <details className={styles.advanced}>
              <summary>
                <span>
                  <Bot size={16} />
                  Add optional details
                </span>
                <small>Useful if you already know them; otherwise AI and later review can fill gaps.</small>
                <ChevronDown size={16} />
              </summary>

              <div className={styles.advancedBody}>
                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span>Bedrooms</span>
                    <input min={0} name="bedrooms" placeholder="1" type="number" />
                  </label>
                  <label className={styles.field}>
                    <span>Bathrooms</span>
                    <input min={0} name="bathrooms" placeholder="1" type="number" />
                  </label>
                  <label className={styles.field}>
                    <span>Floor</span>
                    <input min={0} name="floor" placeholder="12" type="number" />
                  </label>
                  <label className={styles.wideField}>
                    <span>Agent note</span>
                    <textarea name="description" placeholder="Raw note: view, condition, buyer/renter angle, owner comments." />
                  </label>
                </div>

                <div className={styles.commercialGrid}>
                  <div className={styles.sectionTitle}>
                    <CircleDollarSign size={16} />
                    Commercial signals
                  </div>
                  <label className={styles.field}>
                    <span>Target sale price THB</span>
                    <input min={0} name="priceThb" placeholder="3500000" step="1000" type="number" />
                  </label>
                  <label className={styles.field}>
                    <span>Monthly rent THB</span>
                    <input min={0} name="rentalPriceMonthlyThb" placeholder="24000" step="500" type="number" />
                  </label>
                  <label className={styles.field}>
                    <span>Rent estimate THB</span>
                    <input min={0} name="monthlyRentEstimateThb" placeholder="26000" step="500" type="number" />
                  </label>
                  <label className={styles.field}>
                    <span>Maintenance/mo THB</span>
                    <input min={0} name="maintenanceFeeMonthlyThb" placeholder="2200" step="100" type="number" />
                  </label>
                  <label className={styles.field}>
                    <span>Beach distance m</span>
                    <input min={0} name="beachDistanceMeters" placeholder="450" type="number" />
                  </label>
                  <label className={styles.wideField}>
                    <span>Amenities</span>
                    <input name="amenities" placeholder="pool, gym, sea view, fiber internet" />
                  </label>
                </div>
              </div>
            </details>

            <div className={styles.actions}>
              <button type="submit">
                <Plus size={16} />
                Create AI-ready draft
              </button>
              <small>Next: review the created listing, approve AI photo signals, generate copy, and publish.</small>
            </div>
          </form>
        </div>
      </details>
    </section>
  );
}
